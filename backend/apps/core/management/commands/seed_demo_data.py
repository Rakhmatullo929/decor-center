"""Seed demo data for development and showcasing: employees with photos,
an approved question bank for every module, instructions, finished test
sessions and medical checks.

Idempotent: records are matched by their natural keys (question text,
employee full name, instruction title); existing rows are left untouched.
Run after `seed_initial_data` (needs the SRS specialties and role accounts).
"""
import io
from datetime import timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from PIL import Image

from apps.accounts.models import Roles, User
from apps.assessments.models import Module, Question, TestAnswer, TestSession, pass_threshold
from apps.employees.models import Employee, Specialty
from apps.instructions.models import Instruction
from apps.integrations.base import NoFaceDetectedError
from apps.integrations.registry import get_face_recognition_service
from apps.medical.models import MedicalCheck
from apps.medical.services import record_created

MACHINIST = "Engine driver (machinist)"
ASSISTANT = "Assistant engine driver"
DEPOT_OFFICER = "Depot duty officer"
LOCKSMITH = "Locksmith (fitter)"
TRAINING_DRIVER = "Engine driver for training affairs"
CHIEF_MASTER = "Chief master for training affairs"

# (full_name, specialty, photo RGB color)
DEMO_EMPLOYEES = [
    ("Karimov Aziz Baxtiyorovich", MACHINIST, (52, 120, 186)),
    ("Toshpulatov Jasur Olimovich", MACHINIST, (186, 90, 52)),
    ("Raximov Sherzod Shavkatovich", ASSISTANT, (60, 160, 90)),
    ("Ergashev Dilshod Nuriddinovich", ASSISTANT, (140, 80, 170)),
    ("Yusupova Nilufar Akmalovna", "Depot duty officer", (200, 150, 40)),
    ("Saidov Bobur Ravshanovich", "Locksmith (fitter)", (90, 90, 200)),
    ("Qodirov Farrux Ikromovich", "Engine driver for training affairs", (40, 170, 170)),
    ("Mirzayev Otabek G'ayratovich", "Chief master for training affairs", (170, 60, 110)),
]

# (text, [4 options], correct_option). Specialty is resolved per bank below.
TECH_SAFETY_QUESTIONS = [
    (
        "Какое напряжение в контактной сети постоянного тока на электрифицированных участках?",
        ["10 кВ", "3 кВ", "25 кВ", "0,4 кВ"],
        1,
    ),
    (
        "На каком минимальном расстоянии разрешается находиться от токоведущих частей контактной "
        "сети 25 кВ без защитных средств?",
        ["0,5 м", "1 м", "2 м", "4 м"],
        2,
    ),
    (
        "Что необходимо выполнить перед осмотром крышевого оборудования электровоза?",
        [
            "Снять напряжение с контактной сети и заземлить её",
            "Надеть диэлектрические перчатки",
            "Получить устное разрешение машиниста",
            "Опустить токоприёмник, не снимая напряжения",
        ],
        0,
    ),
    (
        "Каким огнетушителем разрешается тушить электрооборудование под напряжением до 1000 В?",
        ["Пенным", "Водным", "Любым имеющимся", "Углекислотным"],
        3,
    ),
    (
        "Действия работника при обнаружении оборванного провода контактной сети:",
        [
            "Убрать провод с пути подручными средствами",
            "Оградить место обрыва и сообщить энергодиспетчеру, не приближаясь ближе 8 м",
            "Перешагнуть провод и продолжить работу",
            "Накрыть провод деревянным щитом",
        ],
        1,
    ),
    (
        "Как следует покидать зону растекания тока вблизи упавшего провода?",
        [
            "Бегом по кратчайшему пути",
            "Широкими шагами",
            "Мелкими шагами, не отрывая ступни от земли",
            "Любым удобным способом",
        ],
        2,
    ),
    (
        "Перед началом ремонтных работ локомотив в депо необходимо:",
        [
            "Затормозить ручным тормозом и закрепить тормозными башмаками",
            "Оставить на вспомогательном тормозе",
            "Достаточно выключить контроллер",
            "Дополнительных мер не требуется",
        ],
        0,
    ),
    (
        "Средства индивидуальной защиты при работе с аккумуляторной батареей локомотива:",
        [
            "Каска и сигнальный жилет",
            "Респиратор",
            "Хлопчатобумажные перчатки",
            "Защитные очки, резиновые перчатки и фартук",
        ],
        3,
    ),
    (
        "Разрешается ли подниматься на крышу локомотива под контактным проводом под напряжением?",
        [
            "Разрешается в диэлектрических перчатках",
            "Запрещается во всех случаях",
            "Разрешается при опущенном токоприёмнике",
            "Разрешается с разрешения машиниста",
        ],
        1,
    ),
    (
        "Что проверяется перед использованием переносной лестницы?",
        [
            "Только длина лестницы",
            "Дата изготовления",
            "Исправность, отсутствие трещин и наличие нескользящих упоров",
            "Цвет окраски",
        ],
        2,
    ),
    (
        "Первое действие при поражении человека электрическим током:",
        [
            "Прекратить действие тока на пострадавшего (отключить источник)",
            "Дать пострадавшему воды",
            "Начать массаж сердца, не отключая ток",
            "Ожидать прибытия врача, ничего не предпринимая",
        ],
        0,
    ),
    (
        "Где разрешается переходить железнодорожные пути на территории депо?",
        [
            "В любом месте при отсутствии подвижного состава",
            "Под вагонами",
            "По автосцепкам",
            "По установленным маршрутам служебного прохода",
        ],
        3,
    ),
]

INDUSTRIAL_SAFETY_QUESTIONS = [
    (
        "Что относится к первичным средствам пожаротушения?",
        [
            "Огнетушители, пожарные краны, ящики с песком, кошма",
            "Только пожарные автомобили",
            "Системы автоматического пожаротушения",
            "Вода из любых ёмкостей",
        ],
        0,
    ),
    (
        "С какой периодичностью проводится повторный инструктаж по охране труда?",
        [
            "Один раз в год",
            "Не реже одного раза в 6 месяцев",
            "Один раз в 3 года",
            "Только при приёме на работу",
        ],
        1,
    ),
    (
        "Что обязан надеть работник перед выходом на железнодорожные пути?",
        [
            "Головной убор",
            "Тёплую куртку",
            "Сигнальный жилет со светоотражающими полосами",
            "Резиновые сапоги",
        ],
        2,
    ),
    (
        "Допустимая норма разового подъёма груза вручную для мужчин:",
        ["До 50 кг", "До 80 кг", "Без ограничений", "До 30 кг"],
        3,
    ),
    (
        "Действия при обнаружении пожара в депо:",
        [
            "Сообщить в пожарную охрану, оповестить людей и приступить к тушению первичными средствами",
            "Самостоятельно тушить до полной ликвидации, никому не сообщая",
            "Покинуть территорию депо",
            "Ожидать указаний руководителя",
        ],
        0,
    ),
    (
        "Знак безопасности в виде жёлтого треугольника с чёрной каймой означает:",
        ["Запрещающий знак", "Предупреждающий знак", "Предписывающий знак", "Указательный знак"],
        1,
    ),
    (
        "Что запрещается при нахождении локомотива на смотровой канаве?",
        [
            "Осматривать экипажную часть",
            "Пользоваться переносным освещением 12 В",
            "Находиться в канаве при вводе и выводе локомотива",
            "Производить замеры бандажей",
        ],
        2,
    ),
    (
        "Как должны храниться легковоспламеняющиеся жидкости в депо?",
        [
            "На рабочих местах в открытой таре",
            "В кабине локомотива",
            "Возле отопительных приборов",
            "В закрытой таре в специально отведённых кладовых",
        ],
        3,
    ),
    (
        "Первая помощь при термическом ожоге:",
        [
            "Охладить место ожога водой и наложить стерильную повязку",
            "Смазать ожог маслом",
            "Вскрыть образовавшиеся пузыри",
            "Оторвать прилипшую одежду",
        ],
        0,
    ),
    (
        "Кто допускается к работе с грузоподъёмными механизмами?",
        [
            "Любой работник депо",
            "Работники, прошедшие обучение и проверку знаний, имеющие удостоверение",
            "Работники со стажем более года",
            "Только руководители подразделений",
        ],
        1,
    ),
    (
        "Сигнальный красный цвет в производственной зоне означает:",
        ["Безопасность", "Информацию", "Запрещение, непосредственную опасность", "Предписание"],
        2,
    ),
    (
        "При несчастном случае на производстве работник обязан:",
        [
            "Продолжить работу до конца смены",
            "Сообщить о случившемся только пострадавшему",
            "Покинуть место происшествия",
            "Оказать первую помощь пострадавшему и сообщить руководителю работ",
        ],
        3,
    ),
]

MACHINIST_QUESTIONS = [
    (
        "Действия машиниста при жёлтом огне проходного светофора:",
        [
            "Следовать с готовностью остановиться: следующий светофор закрыт",
            "Следовать с установленной скоростью",
            "Немедленно остановить поезд",
            "Увеличить скорость для проследования участка",
        ],
        0,
    ),
    (
        "Полное опробование автотормозов производится:",
        [
            "Только по требованию машиниста",
            "С проверкой действия тормозов у всех вагонов состава",
            "С проверкой тормозов двух хвостовых вагонов",
            "Только у локомотива",
        ],
        1,
    ),
    (
        "Зарядное давление в тормозной магистрали гружёного грузового поезда:",
        ["3,8–4,0 кгс/см²", "6,5–6,8 кгс/см²", "5,3–5,5 кгс/см²", "2,0–2,5 кгс/см²"],
        2,
    ),
    (
        "При вынужденной остановке поезда на перегоне машинист обязан:",
        [
            "Покинуть локомотив для осмотра состава",
            "Ожидать указаний, никому не сообщая",
            "Продолжить движение после короткой стоянки",
            "Остановить поезд, сообщить ДНЦ (ДСП) и машинистам встречных поездов",
        ],
        3,
    ),
    (
        "Скорость приёма поезда на боковой путь по стрелочным переводам с маркой крестовины 1/9:",
        ["Не более 40 км/ч", "Не более 60 км/ч", "Не более 25 км/ч", "Не более 80 км/ч"],
        0,
    ),
    (
        "Звуковой сигнал «три коротких» означает:",
        ["«Отправиться поезду»", "«Стой!»", "«Поднять токоприёмник»", "«Опустить токоприёмник»"],
        1,
    ),
    (
        "Проверка действия автотормозов в пути следования выполняется:",
        [
            "Только при неисправности тормозов",
            "По усмотрению помощника машиниста",
            "На установленном перегоне со снижением скорости на заданную величину",
            "Только в зимний период",
        ],
        2,
    ),
    (
        "При появлении белого огня на локомотивном светофоре на кодированном участке машинист должен:",
        [
            "Продолжать движение с установленной скоростью",
            "Остановить поезд экстренным торможением",
            "Отключить устройства безопасности",
            "Снизить скорость и вести поезд до следующего светофора с особой бдительностью",
        ],
        3,
    ),
    (
        "Автостоп предназначен для:",
        [
            "Автоматической остановки поезда при проезде запрещающего сигнала или потере бдительности",
            "Автоматического разгона поезда",
            "Управления токоприёмником",
            "Подачи звуковых сигналов",
        ],
        0,
    ),
    (
        "Перед отправлением поезда со станции машинист обязан убедиться:",
        [
            "Только в исправности радиосвязи",
            "В разрешающем показании светофора и получении установленного сигнала отправления",
            "В наличии топлива",
            "В отсутствии пассажиров на платформе",
        ],
        1,
    ),
    (
        "Максимальная скорость при манёврах вагонами вперёд по свободным путям:",
        ["60 км/ч", "40 км/ч", "25 км/ч", "10 км/ч"],
        2,
    ),
    (
        "При срабатывании средств контроля схода подвижного состава машинист обязан:",
        [
            "Продолжить движение до ближайшей станции",
            "Увеличить скорость",
            "Передать управление помощнику",
            "Остановить поезд служебным торможением и осмотреть состав",
        ],
        3,
    ),
]

ASSISTANT_QUESTIONS = [
    (
        "Основная обязанность помощника машиниста при следовании поезда:",
        [
            "Наблюдение за сигналами, состоянием пути и контактной сети с повторением показаний",
            "Управление локомотивом",
            "Ведение переговоров по личному телефону",
            "Отдых до прибытия на станцию",
        ],
        0,
    ),
    (
        "При приёмке локомотива помощник машиниста проверяет:",
        [
            "Только наличие инструмента",
            "Экипажную часть, наличие инвентаря, средств пожаротушения и сигнализации",
            "Только запас песка",
            "Только чистоту кабины",
        ],
        1,
    ),
    (
        "Закрепление локомотива тормозными башмаками выполняет:",
        ["Дежурный по депо", "Машинист", "Помощник машиниста по указанию машиниста", "Составитель"],
        2,
    ),
    (
        "При подходе поезда к светофору помощник машиниста обязан:",
        [
            "Молча наблюдать за машинистом",
            "Записать показание в журнал",
            "Сообщить показание по радиосвязи ДСП",
            "Назвать показание светофора и убедиться, что машинист его воспринял",
        ],
        3,
    ),
    (
        "Разрешается ли помощнику машиниста покидать кабину при движении поезда?",
        [
            "Только по распоряжению машиниста в установленных случаях",
            "Разрешается в любое время",
            "Запрещается во всех случаях",
            "Только на спусках",
        ],
        0,
    ),
    (
        "При осмотре экипажной части локомотива особое внимание уделяется:",
        [
            "Окраске кузова",
            "Колёсным парам, буксовым узлам и рессорному подвешиванию",
            "Состоянию кабины",
            "Зеркалам заднего вида",
        ],
        1,
    ),
    (
        "Действия помощника при внезапной потере машинистом способности управлять локомотивом:",
        [
            "Продолжить ведение поезда до конечной станции",
            "Покинуть кабину",
            "Остановить поезд и сообщить ДНЦ (ДСП) по радиосвязи",
            "Ожидать восстановления работоспособности машиниста",
        ],
        2,
    ),
    (
        "Уровень масла в картере компрессора проверяется:",
        [
            "Только при ремонте в депо",
            "Один раз в месяц",
            "Только при посторонних шумах",
            "При приёмке локомотива и в пути следования при стоянках",
        ],
        3,
    ),
    (
        "При опробовании автотормозов помощник машиниста:",
        [
            "Участвует в проверке по указанию машиниста и докладывает о результатах",
            "Не участвует",
            "Самостоятельно отпускает тормоза без команды",
            "Управляет локомотивом",
        ],
        0,
    ),
    (
        "Минимальное давление в главных резервуарах перед выездом из депо:",
        ["4,0 кгс/см²", "Не ниже 7,5 кгс/см²", "2,5 кгс/см²", "Давление не нормируется"],
        1,
    ),
    (
        "Тормозные башмаки при закреплении состава укладываются:",
        [
            "Под любой вагон в середине состава",
            "Только под локомотив",
            "Под колёсные пары со стороны уклона по установленной норме",
            "На рельсы рядом с составом",
        ],
        2,
    ),
    (
        "Перед проследованием нейтральной вставки контактной сети помощник машиниста:",
        [
            "Поднимает второй токоприёмник",
            "Включает отопление поезда",
            "Покидает кабину",
            "Контролирует подготовку электровоза и напоминает машинисту о её проследовании",
        ],
        3,
    ),
]

# Uzbek-language bank (Latin script) — used to test Uzbek question text + uz-UZ TTS.
DEPOT_OFFICER_QUESTIONS = [
    (
        "Depo navbatchisining asosiy vazifasi nima?",
        [
            "Lokomotivlarni ta'mirlash",
            "Depoda lokomotivlarni qabul qilish, berish va joylashtirishni tashkil etish va nazorat qilish",
            "Poyezdni peregonda boshqarish",
            "Buxgalteriya hisobini yuritish",
        ],
        1,
    ),
    (
        "Lokomotivni poyezd ostiga berishdan oldin depo navbatchisi nimaga ishonch hosil qilishi shart?",
        [
            "Faqat qum borligiga",
            "Faqat kabina tozaligiga",
            "Lokomotiv tayyorligi, ekipirovka borligi va lokomotiv brigadasining ishga ruxsatiga",
            "Lokomotiv bo'yog'i rangiga",
        ],
        2,
    ),
    (
        "Depo hududida manevr harakatlari qanday amalga oshiriladi?",
        [
            "Har qanday xodimning og'zaki buyrug'i bilan",
            "Yo'llar bo'sh bo'lganda kelishuvsiz",
            "Eng yuqori tezlikda",
            "Depo navbatchisining ko'rsatmasi bilan, belgilangan tartib va tezliklarga rioya qilgan holda",
        ],
        3,
    ),
    (
        "Navbatni qabul qilish va topshirish to'g'risidagi yozuv qayerda amalga oshiriladi?",
        [
            "Depo navbatchisining ish stoli jurnalida",
            "Ro'yxatga olinmasdan alohida varaqlarda",
            "Faqat og'zaki",
            "Shaxsiy bloknotda",
        ],
        0,
    ),
    (
        "Lokomotiv nosozligi aniqlanganda depo navbatchisi nima qiladi?",
        [
            "Vaqtni tejash uchun uni poyezd ostiga beradi",
            "Berishga yo'l qo'ymaydi va lokomotivni ko'rikdan (ta'mirga) yo'naltiradi",
            "Smena oxirigacha e'tibor bermaydi",
            "Qarorni mashinistga topshiradi",
        ],
        1,
    ),
    (
        "Lokomotiv brigadalari ishga kelganda mehnat va dam olish rejimini kim nazorat qiladi?",
        [
            "Faqat tibbiyot xodimi",
            "Faqat mashinist-instruktor",
            "Depo navbatchisi naryadchi bilan birgalikda, ishga kelish va ruxsat qismida",
            "Hech kim, bu depo vazifasiga kirmaydi",
        ],
        2,
    ),
    (
        "Lokomotiv brigadasini ishga qo'yishdan oldin nimaning mavjudligi tekshiriladi?",
        [
            "Shaxsiy buyumlar",
            "Brigadada yoqilg'i zaxirasi",
            "Sport formasi",
            "Reys oldidan tibbiy ko'rik va tegishli hujjatlar (guvohnoma/huquqlar)",
        ],
        3,
    ),
    (
        "Depo binosida yong'in chiqqanda depo navbatchisining harakatlari qanday bo'ladi?",
        [
            "Trevoga signalini berish, yong'in xizmatini chaqirish hamda evakuatsiya va o'chirishni tashkil etish",
            "Boshliq kelguncha ishni davom ettirish",
            "Hech kimni ogohlantirmasdan depodan chiqib ketish",
            "Yoritishni o'chirib, kutish",
        ],
        0,
    ),
    (
        "Lokomotivlarni depo yo'llarida joylashtirish nimani ta'minlashi kerak?",
        [
            "O'tish joylarisiz iloji boricha zich joylashtirish",
            "To'siqsiz chiqishni hamda gabarit va yong'in xavfsizligi normalariga rioya qilishni",
            "Faqat ko'rik kanavalarida joylashtirish",
            "Mashinist qaroriga ko'ra ixtiyoriy joylashtirish",
        ],
        1,
    ),
    (
        "Lokomotivlarni poyezdlar ostiga berish to'g'risidagi ma'lumotni depo navbatchisi kimga uzatadi?",
        [
            "Faqat smena oxirida",
            "Shaxsiy xohishiga ko'ra",
            "Poyezd dispetcheriga (DNTs) va stansiya navbatchisiga (DSP) belgilangan tartibda",
            "Uzatilmaydi",
        ],
        2,
    ),
]

LOCKSMITH_QUESTIONS = [
    (
        "Перед началом ремонтных работ слесарь обязан:",
        [
            "Приступить к работе без подготовки",
            "Проверить исправность инструмента, приспособлений и средств защиты",
            "Снять ограждения",
            "Отключить вентиляцию",
        ],
        1,
    ),
    (
        "Работы на локомотиве в смотровой канаве разрешается выполнять:",
        [
            "Без освещения",
            "При работающем дизеле без согласования",
            "При снятом напряжении, закреплённом локомотиве и установленных знаках безопасности",
            "В одиночку без оповещения",
        ],
        2,
    ),
    (
        "Слесарный инструмент с повреждённой рукояткой или бойком:",
        [
            "Можно использовать с осторожностью",
            "Используется до конца смены",
            "Применяется только для лёгких работ",
            "К работе не допускается и подлежит замене",
        ],
        3,
    ),
    (
        "Перед подъёмом узла грузоподъёмным механизмом слесарь проверяет:",
        [
            "Исправность строп, грузозахватных приспособлений и срок их испытания",
            "Только цвет груза",
            "Наличие свободного времени",
            "Температуру воздуха",
        ],
        0,
    ),
    (
        "При работе с электроинструментом класса I обязательно:",
        [
            "Работать без перчаток",
            "Применение защитного заземления (зануления) и средств индивидуальной защиты",
            "Удлинять кабель скрутками",
            "Снять кожухи для удобства",
        ],
        1,
    ),
    (
        "Замер износа деталей при ремонте колёсных пар выполняется:",
        [
            "На глаз",
            "Линейкой произвольно",
            "Поверенным мерительным инструментом по установленным нормам",
            "Не выполняется",
        ],
        2,
    ),
    (
        "При обнаружении трещины в ответственной детали слесарь должен:",
        [
            "Заварить и продолжить сборку",
            "Зачистить и не сообщать",
            "Установить деталь обратно",
            "Прекратить работу и сообщить мастеру, деталь забраковать",
        ],
        3,
    ),
    (
        "Промывка деталей в моечных растворах производится:",
        [
            "В защитных перчатках и очках при работающей вентиляции",
            "Голыми руками",
            "При отключённой вентиляции",
            "Рядом с открытым огнём",
        ],
        0,
    ),
    (
        "Хранение обтирочных промасленных материалов допускается:",
        [
            "В любом удобном месте",
            "В закрывающихся металлических ящиках с последующей утилизацией",
            "На рабочем столе",
            "На электрооборудовании",
        ],
        1,
    ),
    (
        "Окончив работу, слесарь обязан:",
        [
            "Оставить инструмент на канаве",
            "Уйти, не убирая рабочее место",
            "Привести в порядок рабочее место, убрать инструмент и сообщить мастеру об итогах",
            "Отключить освещение всего цеха",
        ],
        2,
    ),
]

TRAINING_DRIVER_QUESTIONS = [
    (
        "Основная задача машиниста по обучению (по подготовке кадров):",
        [
            "Ведение грузовых поездов",
            "Ремонт локомотивов",
            "Практическое обучение и контроль приобретения навыков управления локомотивом",
            "Диспетчерское руководство движением",
        ],
        2,
    ),
    (
        "Перед допуском обучаемого к управлению локомотивом машинист-обучающий обязан:",
        [
            "Убедиться в наличии у обучаемого необходимых документов и теоретической подготовки",
            "Покинуть кабину",
            "Передать обучаемому управление без проверки",
            "Отключить устройства безопасности",
        ],
        0,
    ),
    (
        "Во время практической поездки обучаемого ответственность за безопасность несёт:",
        [
            "Только обучаемый",
            "Машинист по обучению, контролирующий действия и готовый вмешаться",
            "Дежурный по депо",
            "Поездной диспетчер",
        ],
        1,
    ),
    (
        "Отработка навыков управления автотормозами проводится:",
        [
            "Без плана и контроля",
            "Только на стоянке",
            "По установленной программе с поэтапным усложнением и контролем",
            "Однократно перед экзаменом",
        ],
        2,
    ),
    (
        "При грубой ошибке обучаемого, угрожающей безопасности, машинист-обучающий:",
        [
            "Ждёт самостоятельного исправления",
            "Делает замечание после поездки",
            "Фиксирует ошибку в журнале и продолжает движение",
            "Немедленно вмешивается и берёт управление на себя",
        ],
        3,
    ),
    (
        "Результаты практического обучения машинист по обучению:",
        [
            "Фиксирует в маршруте/журнале с оценкой освоенных навыков",
            "Не фиксирует",
            "Сообщает только устно обучаемому",
            "Передаёт в медпункт",
        ],
        0,
    ),
    (
        "Обучение действиям в нестандартных ситуациях должно включать:",
        [
            "Только теорию",
            "Порядок остановки поезда, ограждения и доклада при вынужденной остановке",
            "Запрет на обсуждение аварийных ситуаций",
            "Только заполнение документов",
        ],
        1,
    ),
    (
        "Допуск обучаемого к самостоятельной работе оформляется:",
        [
            "Устным разрешением машиниста",
            "По желанию обучаемого",
            "После сдачи установленных испытаний и приказом (заключением) в установленном порядке",
            "Автоматически по истечении срока",
        ],
        2,
    ),
    (
        "Машинист по обучению при проведении поездки обязан соблюдать:",
        [
            "Только график",
            "Личные предпочтения по скорости",
            "Указания обучаемого",
            "Требования ПТЭ, инструкций и режим труда и отдыха",
        ],
        3,
    ),
    (
        "Контроль за выполнением режима ведения поезда обучаемым ведётся:",
        [
            "По показаниям приборов, скоростемерной ленте (регистратору) и визуальному наблюдению",
            "Только по словам обучаемого",
            "Не ведётся",
            "Только после прибытия в депо",
        ],
        0,
    ),
]

CHIEF_MASTER_QUESTIONS = [
    (
        "Основная задача старшего мастера (по подготовке кадров) депо:",
        [
            "Организация и руководство профессиональной подготовкой и повышением квалификации работников",
            "Личное управление поездами",
            "Ведение медицинских осмотров",
            "Кассовое обслуживание",
        ],
        0,
    ),
    (
        "Планирование обучения работников осуществляется на основе:",
        [
            "Случайного выбора",
            "Потребности производства, графиков и нормативных требований к квалификации",
            "Только пожеланий работников",
            "Погодных условий",
        ],
        1,
    ),
    (
        "Допуск работника к самостоятельной работе оформляется:",
        [
            "Устно бригадиром",
            "Без проверки знаний",
            "После проверки знаний (испытаний) и оформления установленным порядком",
            "По стажу автоматически",
        ],
        2,
    ),
    (
        "Периодическая проверка знаний работников по охране труда проводится:",
        [
            "Один раз за всё время работы",
            "Только при приёме на работу",
            "По желанию работника",
            "В установленные сроки согласно нормативным документам",
        ],
        3,
    ),
    (
        "Ведение учётной документации по обучению и аттестации должно обеспечивать:",
        [
            "Достоверность и прослеживаемость результатов подготовки и проверок знаний",
            "Сокращение записей до минимума",
            "Хранение только в устной форме",
            "Отсутствие персональных данных",
        ],
        0,
    ),
    (
        "При выявлении недостаточной квалификации работника старший мастер:",
        [
            "Игнорирует факт",
            "Организует дополнительное обучение и повторную проверку знаний",
            "Немедленно увольняет",
            "Понижает в должности без разбора",
        ],
        1,
    ),
    (
        "Инструктажи по охране труда на участке организует и контролирует:",
        [
            "Только сам работник",
            "Поездной диспетчер",
            "Старший мастер в части подготовки и проведения в установленном порядке",
            "Никто",
        ],
        2,
    ),
    (
        "Программа производственного обучения должна соответствовать:",
        [
            "Личному усмотрению мастера",
            "Только пожеланиям руководства",
            "Произвольным требованиям",
            "Квалификационным требованиям и утверждённым нормативным документам",
        ],
        3,
    ),
    (
        "Контроль качества подготовки локомотивных кадров включает:",
        [
            "Анализ результатов испытаний, поездок и проверок знаний с разбором ошибок",
            "Только подсчёт количества занятий",
            "Отказ от любой отчётности",
            "Учёт только стажа",
        ],
        0,
    ),
    (
        "При несчастном случае с обучаемым на производстве старший мастер обязан:",
        [
            "Скрыть факт",
            "Организовать первую помощь, сообщить руководству и обеспечить расследование",
            "Продолжить занятие",
            "Отправить пострадавшего домой без оформления",
        ],
        1,
    ),
]

# Draft AI-generated questions: show the moderation queue in the questions section.
DRAFT_QUESTIONS = [
    (
        Module.TECH_SAFETY,
        None,
        "С какой периодичностью проводится электрическое испытание диэлектрических перчаток?",
        ["Один раз в 6 месяцев", "Один раз в год", "Один раз в 3 года", "Не проводится"],
        0,
    ),
    (
        Module.SPECIALTY,
        MACHINIST,
        "Какова максимальная допустимая толщина гребня бандажа колёсной пары локомотива?",
        ["33 мм", "30 мм", "25 мм", "36 мм"],
        0,
    ),
]

INSTRUCTIONS = [
    (
        MACHINIST,
        "Инструкция по эксплуатации тормозного оборудования локомотива",
        "# Инструкция по эксплуатации тормозного оборудования\n\n"
        "Демонстрационный документ для среды разработки.\n\n"
        "1. Порядок полного и сокращённого опробования автотормозов.\n"
        "2. Зарядное давление в тормозной магистрали по родам поездов.\n"
        "3. Проверка действия тормозов в пути следования.\n",
    ),
    (
        ASSISTANT,
        "Должностная инструкция помощника машиниста электровоза",
        "# Должностная инструкция помощника машиниста\n\n"
        "Демонстрационный документ для среды разработки.\n\n"
        "1. Обязанности при приёмке и сдаче локомотива.\n"
        "2. Порядок наблюдения за сигналами и повторения показаний.\n"
        "3. Действия в нестандартных ситуациях.\n",
    ),
]

# (employee, module, correct answers out of 10, days ago)
DEMO_SESSIONS = [
    ("Karimov Aziz Baxtiyorovich", Module.SPECIALTY, 9, 3),
    ("Karimov Aziz Baxtiyorovich", Module.TECH_SAFETY, 10, 2),
    ("Toshpulatov Jasur Olimovich", Module.TECH_SAFETY, 6, 1),
    ("Raximov Sherzod Shavkatovich", Module.SPECIALTY, 8, 0),
    ("Raximov Sherzod Shavkatovich", Module.INDUSTRIAL_SAFETY, 7, 0),
]

# (employee, systolic, diastolic, pulse, saturation, alcohol_positive, conclusion, note)
DEMO_MEDICAL_CHECKS = [
    ("Karimov Aziz Baxtiyorovich", 120, 80, 68, 98, False, MedicalCheck.Conclusion.APPROVED, ""),
    ("Toshpulatov Jasur Olimovich", 118, 76, 72, 99, False, MedicalCheck.Conclusion.APPROVED, ""),
    ("Raximov Sherzod Shavkatovich", 124, 82, 75, 97, False, MedicalCheck.Conclusion.APPROVED, ""),
    (
        "Ergashev Dilshod Nuriddinovich",
        158,
        102,
        96,
        95,
        True,
        MedicalCheck.Conclusion.REJECTED,
        "Повышенное давление, положительная проба на алкоголь. Отстранён от смены.",
    ),
]


def make_photo_bytes(color: tuple[int, int, int]) -> bytes:
    image = Image.new("RGB", (240, 240), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class Command(BaseCommand):
    help = "Seed demo employees, questions, instructions, test sessions and medical checks."

    def handle(self, *args, **options):
        self.seed_employees()
        self.seed_questions()
        self.seed_instructions()
        self.seed_sessions()
        self.seed_medical_checks()
        self.stdout.write(self.style.SUCCESS("Demo data seed completed."))

    def seed_employees(self):
        service = get_face_recognition_service()
        created = 0
        for full_name, specialty_name, color in DEMO_EMPLOYEES:
            if Employee.objects.filter(full_name=full_name).exists():
                continue
            specialty, _ = Specialty.objects.get_or_create(name=specialty_name)
            photo_bytes = make_photo_bytes(color)
            try:
                embedding = service.extract_embedding(photo_bytes)
            except NoFaceDetectedError:
                # Real Face ID backend rejects placeholder images — seed without embedding.
                embedding = None
            employee = Employee(full_name=full_name, specialty=specialty, face_embedding=embedding)
            slug = full_name.split()[0].lower()
            employee.photo.save(f"demo_{slug}.png", ContentFile(photo_bytes), save=True)
            created += 1
        self.stdout.write(f"Employees created: {created}")

    def seed_questions(self):
        banks = [
            (Module.TECH_SAFETY, None, TECH_SAFETY_QUESTIONS),
            (Module.INDUSTRIAL_SAFETY, None, INDUSTRIAL_SAFETY_QUESTIONS),
            (Module.SPECIALTY, MACHINIST, MACHINIST_QUESTIONS),
            (Module.SPECIALTY, ASSISTANT, ASSISTANT_QUESTIONS),
            (Module.SPECIALTY, DEPOT_OFFICER, DEPOT_OFFICER_QUESTIONS),
            (Module.SPECIALTY, LOCKSMITH, LOCKSMITH_QUESTIONS),
            (Module.SPECIALTY, TRAINING_DRIVER, TRAINING_DRIVER_QUESTIONS),
            (Module.SPECIALTY, CHIEF_MASTER, CHIEF_MASTER_QUESTIONS),
        ]
        created = 0
        for module, specialty_name, bank in banks:
            specialty = (
                Specialty.objects.get_or_create(name=specialty_name)[0] if specialty_name else None
            )
            for text, options, correct_option in bank:
                _, was_created = Question.objects.get_or_create(
                    text=text,
                    defaults={
                        "module": module,
                        "specialty": specialty,
                        "options": options,
                        "correct_option": correct_option,
                        "source": Question.Source.MANUAL,
                        "status": Question.Status.APPROVED,
                    },
                )
                created += int(was_created)
        for module, specialty_name, text, options, correct_option in DRAFT_QUESTIONS:
            specialty = (
                Specialty.objects.get_or_create(name=specialty_name)[0] if specialty_name else None
            )
            _, was_created = Question.objects.get_or_create(
                text=text,
                defaults={
                    "module": module,
                    "specialty": specialty,
                    "options": options,
                    "correct_option": correct_option,
                    "source": Question.Source.AI,
                    "status": Question.Status.DRAFT,
                },
            )
            created += int(was_created)
        self.stdout.write(f"Questions created: {created}")

    def seed_instructions(self):
        created = 0
        for specialty_name, title, content in INSTRUCTIONS:
            if Instruction.objects.filter(title=title).exists():
                continue
            specialty, _ = Specialty.objects.get_or_create(name=specialty_name)
            instruction = Instruction(
                specialty=specialty,
                title=title,
                generation_status=Instruction.GenerationStatus.NOT_STARTED,
            )
            slug = title.split()[0].lower()
            instruction.file.save(f"demo_{slug}.md", ContentFile(content.encode()), save=True)
            created += 1
        self.stdout.write(f"Instructions created: {created}")

    def seed_sessions(self):
        demo_names = [name for name, *_ in DEMO_EMPLOYEES]
        if TestSession.objects.filter(employee__full_name__in=demo_names).exists():
            self.stdout.write("Test sessions already exist — skipped.")
            return
        created = 0
        for full_name, module, correct, days_ago in DEMO_SESSIONS:
            employee = Employee.objects.filter(full_name=full_name).first()
            if employee is None:
                continue
            queryset = Question.objects.filter(status=Question.Status.APPROVED, module=module)
            if module == Module.SPECIALTY:
                queryset = queryset.filter(specialty=employee.specialty)
            questions = list(queryset.order_by("id")[:10])
            if len(questions) < 10:
                self.stdout.write(self.style.WARNING(f"Not enough questions for {module} — skipped."))
                continue
            started_at = timezone.now() - timedelta(days=days_ago, hours=2)
            with transaction.atomic():
                session = TestSession.objects.create(
                    employee=employee,
                    module=module,
                    specialty=employee.specialty if module == Module.SPECIALTY else None,
                    started_at=started_at,
                    finished_at=started_at + timedelta(minutes=7),
                    score=correct,
                    total=len(questions),
                    passed=correct >= pass_threshold(),
                    face_verified=True,
                )
                TestAnswer.objects.bulk_create(
                    [
                        TestAnswer(
                            session=session,
                            question=question,
                            selected_option=(
                                question.correct_option
                                if index < correct
                                else (question.correct_option + 1) % 4
                            ),
                            is_correct=index < correct,
                        )
                        for index, question in enumerate(questions)
                    ]
                )
            created += 1
        self.stdout.write(f"Test sessions created: {created}")

    def seed_medical_checks(self):
        medic = User.objects.filter(role=Roles.MEDIC).first()
        if medic is None:
            self.stdout.write(self.style.WARNING("No medic account — medical checks skipped."))
            return
        demo_names = [name for name, *_ in DEMO_EMPLOYEES]
        if MedicalCheck.objects.filter(employee__full_name__in=demo_names).exists():
            self.stdout.write("Medical checks already exist — skipped.")
            return
        created = 0
        for full_name, systolic, diastolic, pulse, saturation, alcohol, conclusion, note in (
            DEMO_MEDICAL_CHECKS
        ):
            employee = Employee.objects.filter(full_name=full_name).first()
            if employee is None:
                continue
            check = MedicalCheck.objects.create(
                employee=employee,
                bp_systolic=systolic,
                bp_diastolic=diastolic,
                pulse=pulse,
                saturation=saturation,
                alcohol_value="0.150" if alcohol else "0.000",
                alcohol_positive=alcohol,
                hours_worked="8.0",
                hours_rested="16.0",
                conclusion=conclusion,
                note=note,
                medic=medic,
            )
            record_created(check, medic)
            created += 1
        self.stdout.write(f"Medical checks created: {created}")
