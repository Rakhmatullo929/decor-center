"""Real bilingual (uz/ru) content for the 5 standard surveys, transcribed from the
company's reference document ("Decor_Center_Sorovnomalar_UZ_RU"). Consumed by
`seed_survey_content.py`, which matches each entry to its `Test` by title (the
titles here are exactly the ones created by `seed_surveys.py`).
"""


def _t(uz: str, ru: str) -> dict:
    return {"uz": uz, "ru": ru}


def _opt(idx: int, uz: str, ru: str) -> dict:
    return {"id": f"o{idx}", "text": _t(uz, ru)}


def _scale(min_, max_, left_uz, left_ru, right_uz, right_ru):
    return {
        "min": min_,
        "max": max_,
        "left_label": _t(left_uz, left_ru),
        "right_label": _t(right_uz, right_ru),
    }


def _field(uz, ru, *, field_type="text", required=True):
    return {
        "type": "form_field",
        "text": _t(uz, ru),
        "is_required": required,
        "settings": {"field_type": field_type},
    }


def _text(uz, ru, *, required=True, mind_dive=False):
    return {"type": "textarea", "text": _t(uz, ru), "is_required": required, "is_mind_dive": mind_dive}


def _single(uz, ru, options, *, required=True):
    return {"type": "single", "text": _t(uz, ru), "is_required": required, "options": options}


def _multiple(uz, ru, options, *, required=True):
    return {"type": "multiple", "text": _t(uz, ru), "is_required": required, "options": options}


def _nps10(uz, ru, left_uz, left_ru, right_uz, right_ru, *, min_=1, required=True):
    return {
        "type": "nps",
        "text": _t(uz, ru),
        "is_required": required,
        "settings": _scale(min_, 10, left_uz, left_ru, right_uz, right_ru),
    }


def _scale5(uz, ru, left_uz, left_ru, right_uz, right_ru, *, required=True):
    return {
        "type": "scale5",
        "text": _t(uz, ru),
        "is_required": required,
        "settings": _scale(1, 5, left_uz, left_ru, right_uz, right_ru),
    }


def _signature(uz, ru):
    return {"type": "signature_date", "text": _t(uz, ru), "is_required": False}


GENERAL_INFO_BLOCK_TITLE = _t("UMUMIY MA'LUMOT", "ОБЩАЯ ИНФОРМАЦИЯ")


SURVEYS_CONTENT = [
    # ------------------------------------------------------------------
    # 1) Глубокий опрос — CHUQUR SO'ROVNOMA (полугодовой, январь и июль)
    # ------------------------------------------------------------------
    {
        "test_title": "Глубокий опрос",
        "blocks": [
            {
                "title": _t("I. UMUMIY MA'LUMOT", "I. ОБЩАЯ ИНФОРМАЦИЯ"),
                "questions": [
                    _field("Ism va familiya", "Ф.И.О."),
                    _field("Lavozim", "Должность"),
                    _field("Ish muddati", "Стаж работы"),
                    _field("Sana", "Дата", field_type="date", required=False),
                ],
            },
            {
                "title": _t("II. SODIQLIK", "II. ЛОЯЛЬНОСТЬ"),
                "questions": [
                    _nps10(
                        "Do'stingiz ish qidirsa, Decor Center ni tavsiya qilarmidingiz? (1-10)",
                        "Рекомендовали бы Decor Center другу, ищущему работу? (1-10)",
                        "Tavsiya qilmayman", "Не рекомендую",
                        "Albatta tavsiya qilaman", "Обязательно рекомендую",
                    ),
                    _text(
                        "Decor Center da ishlashning eng yaxshi 3 ta tomoni nima?",
                        "Назовите 3 лучшие стороны работы в Decor Center.",
                        mind_dive=True,
                    ),
                    _text(
                        "Kompaniyada bir narsani o'zgartirsangiz, nimani o'zgartirar edingiz va nima uchun?",
                        "Что бы Вы изменили в компании и почему?",
                        mind_dive=True,
                    ),
                    _single(
                        "Keyingi 1 yil ichida Decor Center da qolasizmi?",
                        "Планируете ли работать в Decor Center в следующем году?",
                        [
                            _opt(1, "Ha, albatta qolaman", "Да, обязательно останусь"),
                            _opt(2, "Ha, lekin vaziyatga qarab", "Да, в зависимости от ситуации"),
                            _opt(3, "Aniq emas, o'ylanmoqdaman", "Не уверен, размышляю"),
                            _opt(4, "Boshqa joyga o'tmoqchiman", "Думаю перейти в другое место"),
                        ],
                    ),
                    _text(
                        "Raqib kompaniya 15-20% yuqori maosh taklif qilsa nima qilasiz? Nima uchun?",
                        "Что сделаете, если конкурент предложит на 15-20% больше? Почему?",
                        mind_dive=True,
                    ),
                ],
            },
            {
                "title": _t("III. MOTIVATSIYA", "III. МОТИВАЦИЯ"),
                "questions": [
                    _multiple(
                        "Sizni eng ko'p motivatsiya qiladigan narsalar? (bir nechta)",
                        "Что больше всего мотивирует Вас? (несколько вариантов)",
                        [
                            _opt(1, "Yaxshi maosh va bonus", "Хорошая зарплата и бонусы"),
                            _opt(2, "Rahbarning e'tirofi", "Признание руководителя"),
                            _opt(3, "Jamoaviy do'stona muhit", "Дружный коллектив"),
                            _opt(4, "Mas'uliyatli topshiriqlar", "Ответственные задачи"),
                            _opt(5, "Karyera o'sishi", "Карьерный рост"),
                            _opt(6, "O'z-o'zini rivojlantirish", "Саморазвитие"),
                            _opt(7, "Ish va hayot balansi", "Баланс работы и жизни"),
                            _opt(8, "Kompaniya missiyasiga ishonch", "Вера в миссию компании"),
                        ],
                    ),
                    _text(
                        "Oxirgi 3 oyda eng YAXSHI his qilgan paytingizni tasvirlab bering.",
                        "Опишите момент за 3 месяца, когда чувствовали себя ЛУЧШЕ всего.",
                        mind_dive=True,
                    ),
                    _text(
                        "Oxirgi 3 oyda eng PAST his qilgan paytingiz qaysi edi?",
                        "Опишите момент за 3 месяца, когда чувствовали себя ХУЖЕ всего.",
                        mind_dive=True,
                    ),
                    _single(
                        "Rahbar ishingizni qadrlayotganini his qilasizmi?",
                        "Чувствуете, что руководитель ценит Вашу работу?",
                        [
                            _opt(1, "Ha, men qadrlanaman", "Да, я чувствую, что меня ценят"),
                            _opt(2, "Ba'zan qadrlanaman", "Иногда меня ценят"),
                            _opt(3, "Kamdan-kam e'tirof olaman", "Редко получаю признание"),
                            _opt(4, "Mehnatim ko'rinmaydi", "Мой труд не замечают"),
                        ],
                    ),
                    _text(
                        "Rahbariyat sizni yaxshiroq motivatsiya qilishi uchun nima qilishi kerak?",
                        "Что должно сделать руководство, чтобы мотивировать Вас лучше?",
                        mind_dive=True,
                    ),
                ],
            },
            {
                "title": _t("IV. EHTIYOJ VA ISTAKLAR", "IV. ПОТРЕБНОСТИ И ЖЕЛАНИЯ"),
                "questions": [
                    _scale5(
                        "Hozirgi maoshingizdan qoniqasizmi?",
                        "Удовлетворены ли текущей зарплатой?",
                        "Umuman qoniqmayman", "Не удовлетворён",
                        "To'liq qoniqaman", "Полностью",
                    ),
                    _multiple(
                        "Kompaniyadan qaysi sohalarda ko'proq qo'llab-quvvatlash istaysiz?",
                        "В каких областях хотите больше поддержки?",
                        [
                            _opt(1, "Kasbiy o'qitish va trening", "Профессиональное обучение"),
                            _opt(2, "Aniq karyera yo'l xaritasi", "Чёткий план карьеры"),
                            _opt(3, "Rahbardan ko'proq feedback", "Больше обратной связи"),
                            _opt(4, "Jamoaviy tadbirlar", "Командные мероприятия"),
                            _opt(5, "Moslashuvchan ish grafigi", "Гибкий график"),
                            _opt(6, "Zamonaviy ish qurollari", "Современные инструменты"),
                            _opt(7, "Ruhiy qo'llab-quvvatlash", "Психологическая поддержка"),
                        ],
                    ),
                    _text(
                        "5 yildan keyin qayerda va kim bo'lib ishlashni xohlaysiz? "
                        "Decor Center qanday yordam bera oladi?",
                        "Где и кем хотите работать через 5 лет? Как Decor Center может помочь?",
                        mind_dive=True,
                    ),
                    _text(
                        "Hozirgi vazifalar qobiliyatingizni to'liq ochib berayaptimi?",
                        "Полностью ли раскрывают Ваши способности текущие задачи?",
                        mind_dive=True,
                    ),
                ],
            },
            {
                "title": _t("V. ISH MUHITI", "V. РАБОЧАЯ СРЕДА"),
                "questions": [
                    _scale5(
                        "Jamoangiz bilan munosabatdan qoniqasizmi?",
                        "Удовлетворены ли отношениями в коллективе?",
                        "Juda yomon", "Очень плохо",
                        "Ajoyib", "Отлично",
                    ),
                    _scale5(
                        "Rahbaringizdan qoniqasizmi?",
                        "Удовлетворены ли руководителем?",
                        "Umuman qoniqmayman", "Не удовлетворён",
                        "To'liq qoniqaman", "Полностью",
                    ),
                    _single(
                        "Rahbar bilan muammoni erkin gaplasha olasizmi?",
                        "Можете ли свободно обсудить проблему с руководителем?",
                        [
                            _opt(1, "Ha, har doim ochiq gaplasha olaman", "Да, всегда могу открыто"),
                            _opt(2, "Ba'zan, lekin qiyin", "Иногда, но трудно"),
                            _opt(3, "Kamdan-kam, noqulay his qilaman", "Редко, чувствую дискомфорт"),
                            _opt(4, "Yo'q, gapira olmayman", "Нет, не могу"),
                        ],
                    ),
                    _text(
                        "Rahbar siz haqingizda bilishi kerak bo'lgan biror narsani yozing.",
                        "Напишите о себе то, что руководитель должен знать.",
                        mind_dive=True,
                    ),
                ],
            },
            {
                "title": _t("VI. ENERGIYA VA HOLAT", "VI. ЭНЕРГИЯ И СОСТОЯНИЕ"),
                "questions": [
                    _nps10(
                        "Umumiy ish qoniqish darajangiz.",
                        "Общий уровень удовлетворённости работой.",
                        "Umuman qoniqmayman", "Не удовлетворён",
                        "To'liq qoniqaman", "Полностью",
                    ),
                    _single(
                        "Burnout (charchash) his qilyapsizmi?",
                        "Чувствуете ли выгорание?",
                        [
                            _opt(1, "Yo'q, energiyam to'la", "Нет, энергия полная"),
                            _opt(2, "Ba'zan charchayman", "Иногда устаю"),
                            _opt(3, "Ko'pincha charchagan his qilaman", "Часто чувствую усталость"),
                            _opt(4, "Ha, jiddiy charchab ketganman", "Да, серьёзное выгорание"),
                        ],
                    ),
                    _text(
                        "Dushanba ishga kelayotganda qanday his qilasiz?",
                        "Как чувствуете себя, идя на работу в понедельник?",
                        mind_dive=True,
                    ),
                ],
            },
            {
                "title": _t("VII. ERKIN FIKR", "VII. СВОБОДНОЕ МНЕНИЕ"),
                "questions": [
                    _text(
                        "Decor Center ni yanada yaxshi joy qilish uchun qanday taklif?",
                        "Какие предложения для улучшения Decor Center?",
                        required=False,
                    ),
                    _text(
                        "Rahbariyatga maxfiy ravishda yetkazmoqchi narsangiz?",
                        "Что-то конфиденциально для руководства?",
                        required=False,
                    ),
                    _signature("Xodim imzosi", "Подпись сотрудника"),
                ],
            },
        ],
    },
    # ------------------------------------------------------------------
    # 2) Краткий пульс — QISQA HARORAT SO'ROVNOMASI (раз в квартал)
    # ------------------------------------------------------------------
    {
        "test_title": "Краткий пульс",
        "blocks": [
            {
                "title": GENERAL_INFO_BLOCK_TITLE,
                "questions": [
                    _field("Ism va familiya", "Ф.И.О."),
                    _field("Lavozim", "Должность"),
                    _field("Sana", "Дата", field_type="date", required=False),
                ],
            },
            {
                "title": _t("TEZKOR BAHOLASH", "БЫСТРАЯ ОЦЕНКА"),
                "questions": [
                    _nps10(
                        "Umumiy ish qoniqish?",
                        "Общая удовлетворённость работой?",
                        "Juda yomon", "Очень плохо",
                        "Ajoyib", "Отлично",
                    ),
                    _scale5(
                        "Bugungi energiya va kayfiyat darajangiz?",
                        "Ваш уровень энергии и настроения сегодня?",
                        "Juda charchagan", "Очень устал",
                        "Energiyam to'la", "Полная энергия",
                    ),
                    _scale5(
                        "Rahbar bilan munosabatdan qoniqasizmi?",
                        "Удовлетворены ли отношениями с руководителем?",
                        "Umuman qoniqmayman", "Не удовлетворён",
                        "To'liq qoniqaman", "Полностью",
                    ),
                    _single(
                        "Hozirgi ish yukingizdan qoniqasizmi?",
                        "Удовлетворены ли рабочей нагрузкой?",
                        [
                            _opt(1, "Juda ko'p — charchayapman", "Слишком много — устал"),
                            _opt(2, "Biroz ko'p", "Немного многовато"),
                            _opt(3, "Ideal darajada", "На идеальном уровне"),
                            _opt(4, "Biroz kam", "Немного мало"),
                        ],
                    ),
                    _text(
                        "Bu chorakda nima eng yaxshi ketdi?",
                        "Что в этом квартале прошло лучше всего?",
                        mind_dive=True,
                    ),
                    _text(
                        "Bu chorakda nima sizni qiynadi?",
                        "Что в этом квартале Вас затруднило?",
                        mind_dive=True,
                    ),
                    _text(
                        "Keyingi chorak uchun bitta taklif?",
                        "Одно предложение на следующий квартал?",
                        required=False,
                        mind_dive=True,
                    ),
                    _signature("Xodim imzosi", "Подпись сотрудника"),
                ],
            },
        ],
    },
    # ------------------------------------------------------------------
    # 3) 1в1 ежемесячно (беседа) — INDIVIDUAL SUHBAT 1:1
    # ------------------------------------------------------------------
    {
        "test_title": "1в1 ежемесячно (беседа)",
        "blocks": [
            {
                "title": GENERAL_INFO_BLOCK_TITLE,
                "questions": [
                    _field("Xodim ismi", "Ф.И.О. сотрудника"),
                    _field("Lavozim", "Должность"),
                    _field("Rahbar ismi", "Ф.И.О. руководителя"),
                    _field("Suhbat sanasi", "Дата беседы", field_type="date"),
                ],
            },
            {
                "title": _t("SUHBAT SAVOLLARI", "ВОПРОСЫ БЕСЕДЫ"),
                "questions": [
                    _text(
                        "Bu oyda nima eng yaxshi ketdi? Nimadan faxrlanasiz?",
                        "Что в этом месяце прошло лучше всего? Чем гордитесь?",
                        required=False,
                    ),
                    _text("Bu oy nima qiyin bo'ldi?", "Что было трудно в этом месяце?", required=False),
                    _text(
                        "Rahbardan qanday yordam kerak edi?",
                        "Какая помощь нужна была от руководителя?",
                        required=False,
                    ),
                    _text(
                        "Keyingi oy uchun 1-2 ta asosiy maqsadingiz?",
                        "Ваши 1-2 основные цели на следующий месяц?",
                        required=False,
                    ),
                    _text(
                        "Biror narsa o'zgarishini istaysizmi?",
                        "Хотите ли, чтобы что-то изменилось?",
                        required=False,
                        mind_dive=True,
                    ),
                    _text(
                        "Rahbarga aytmoqchi bo'lgan gapingiz bormi?",
                        "Есть что сказать руководителю?",
                        required=False,
                        mind_dive=True,
                    ),
                ],
            },
            {
                "title": _t("KELISHUVLAR", "ДОГОВОРЁННОСТИ"),
                "questions": [
                    {
                        "type": "short_text",
                        "text": _t(
                            "Keyingi oyga qadar bajarilishi kerak (1)",
                            "Должно быть выполнено до следующего месяца (1)",
                        ),
                        "is_required": False,
                    },
                    {
                        "type": "short_text",
                        "text": _t(
                            "Keyingi oyga qadar bajarilishi kerak (2)",
                            "Должно быть выполнено до следующего месяца (2)",
                        ),
                        "is_required": False,
                    },
                    {
                        "type": "short_text",
                        "text": _t(
                            "Keyingi oyga qadar bajarilishi kerak (3)",
                            "Должно быть выполнено до следующего месяца (3)",
                        ),
                        "is_required": False,
                    },
                    _signature("Xodim imzosi", "Подпись сотрудника"),
                    _signature("Rahbar imzosi", "Подпись руководителя"),
                    _field("Keyingi suhbat sanasi", "Дата следующей беседы", field_type="date", required=False),
                ],
            },
        ],
    },
    # ------------------------------------------------------------------
    # 4) Через 30 дней после найма — YANGI XODIM — 30 KUN
    # ------------------------------------------------------------------
    {
        "test_title": "Через 30 дней после найма",
        "blocks": [
            {
                "title": GENERAL_INFO_BLOCK_TITLE,
                "questions": [
                    _field("Ism va familiya", "Ф.И.О."),
                    _field("Lavozim", "Должность"),
                    _field("Ishga kirish sanasi", "Дата приёма", field_type="date"),
                    _field("Bugungi sana", "Сегодняшняя дата", field_type="date", required=False),
                ],
            },
            {
                "title": _t("MOSLASHISH JARAYONI", "ПРОЦЕСС АДАПТАЦИИ"),
                "questions": [
                    _scale5(
                        "Decor Center ga kelishni qanday baholaysiz?",
                        "Как оцениваете свой приход в Decor Center?",
                        "Juda qiyin", "Очень трудно",
                        "Juda oson", "Очень легко",
                    ),
                    _single(
                        "Sizni yaxshi kutib oldimi va yordam berildimi?",
                        "Хорошо ли Вас встретили и помогли?",
                        [
                            _opt(1, "Ha, juda yaxshi kutib olishdi", "Да, встретили очень хорошо"),
                            _opt(2, "O'rtacha, ba'zi yordam bo'ldi", "Средне, была некоторая помощь"),
                            _opt(3, "Yo'q, o'zim moslashishga majbur bo'ldim", "Нет, адаптировался сам"),
                        ],
                    ),
                    _single(
                        "Ish vazifalaringizni aniq tushunyapsizmi?",
                        "Чётко ли понимаете свои обязанности?",
                        [
                            _opt(1, "Ha, to'liq tushunaman", "Да, полностью понимаю"),
                            _opt(
                                2,
                                "Ko'p narsani tushunaman, ba'zilari noaniq",
                                "Многое понимаю, некоторое неясно",
                            ),
                            _opt(3, "Umumiy tushunaman, ko'p savol bor", "В общем, но есть вопросы"),
                            _opt(4, "Yo'q, hali ko'p narsani bilmayman", "Нет, ещё многое не знаю"),
                        ],
                    ),
                    _scale5(
                        "Ish joyingiz kutganingizga mosmi?",
                        "Соответствует ли рабочее место ожиданиям?",
                        "Umuman mos emas", "Не соответствует",
                        "To'liq mos", "Полностью",
                    ),
                    _text(
                        "30 kun ichida eng ko'p qiynagan narsa?",
                        "Что больше всего затруднило за 30 дней?",
                        mind_dive=True,
                    ),
                    _text(
                        "Ishga kirishdan oldin bilishni xohlagan narsalaringiz?",
                        "Что хотели бы знать до трудоустройства?",
                        mind_dive=True,
                    ),
                    _text(
                        "Moslashish jarayonini yaxshilash uchun taklif?",
                        "Предложения по улучшению адаптации?",
                        required=False,
                    ),
                    _signature("Xodim imzosi", "Подпись сотрудника"),
                ],
            },
        ],
    },
    # ------------------------------------------------------------------
    # 5) Через 90 дней после найма — YANGI XODIM — 90 KUN
    # ------------------------------------------------------------------
    {
        "test_title": "Через 90 дней после найма",
        "blocks": [
            {
                "title": GENERAL_INFO_BLOCK_TITLE,
                "questions": [
                    _field("Ism va familiya", "Ф.И.О."),
                    _field("Lavozim", "Должность"),
                    _field("Ishga kirish sanasi", "Дата приёма", field_type="date"),
                    _field("Bugungi sana", "Сегодняшняя дата", field_type="date", required=False),
                ],
            },
            {
                "title": _t("90 KUNLIK BAHOLASH", "ОЦЕНКА 90 ДНЕЙ"),
                "questions": [
                    _nps10(
                        "Decor Center kutganingizga qanchalik mos keldi?",
                        "Насколько соответствует ожиданиям?",
                        "Umuman mos kelmadi", "Не соответствует",
                        "To'liq mos keldi", "Полностью",
                    ),
                    _text(
                        "Ishga kelishdan oldingiz va hozirgini solishtiring. Nima o'zgardi?",
                        "Сравните до и после. Что изменилось?",
                        mind_dive=True,
                    ),
                    _scale5(
                        "Hozirgi lavozim 5 yillik maqsadlaringizga mosmi?",
                        "Соответствует ли должность 5-летним целям?",
                        "Umuman mos emas", "Не соответствует",
                        "To'liq mos", "Полностью",
                    ),
                    _single(
                        "Rahbar rivojlanishingizga yetarli e'tibor bermoqdami?",
                        "Достаточно ли руководитель уделяет внимания?",
                        [
                            _opt(1, "Ha, juda yaxshi qo'llab-quvvatlamoqda", "Да, очень хорошо поддерживает"),
                            _opt(2, "O'rtacha, yaxshilanish kerak", "Средне, нужно улучшить"),
                            _opt(3, "Kam e'tibor beryapti", "Мало внимания уделяет"),
                            _opt(4, "Umuman yo'q", "Совсем не уделяет"),
                        ],
                    ),
                    _text(
                        "Kompaniyada qolishingizni qiyin qiladigan narsa bormi?",
                        "Что мешает остаться в компании?",
                        mind_dive=True,
                    ),
                    _single(
                        "Decor Center da uzoq muddat ishlashni rejalashtiryapsizmi?",
                        "Планируете ли долгосрочную работу?",
                        [
                            _opt(1, "Ha, albatta", "Да, обязательно"),
                            _opt(2, "Ha, vaziyatga qarab", "Да, по ситуации"),
                            _opt(3, "Hali aniqlamadim", "Ещё не определился"),
                            _opt(4, "Ehtimol yo'q", "Скорее нет"),
                        ],
                    ),
                    _text(
                        "Siz uchun qilinishi kerak bo'lgan bitta muhim narsa?",
                        "Одна важная вещь для Вас?",
                        required=False,
                        mind_dive=True,
                    ),
                    _signature("Xodim imzosi", "Подпись сотрудника"),
                ],
            },
        ],
    },
]
