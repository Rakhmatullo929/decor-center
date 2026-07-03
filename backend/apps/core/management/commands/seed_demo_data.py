"""Seed demo decor-center data: employees + one demo survey (blocks + 3 question types).

Idempotent: employees are keyed by full_name and the demo survey by title, so re-running
adds only what is missing. Run `seed_initial_data` (specialties + accounts) first.

Hire dates are stored relative to "today" so the after-hire scheduling (30/90 days) has
live candidates. Employees are created without a face photo — enrol photos in the admin
to enable the Face-ID kiosk.
"""
import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.employees.models import Employee, Specialty
from apps.surveys.models import Question, QuestionBlock, Test

# (full_name, specialty_name, days_since_hire, work_experience_years)
EMPLOYEES = [
    ("Ирина Соколова", "Дизайнер интерьера", 400, 8),
    ("Алексей Ковалёв", "Дизайнер интерьера", 30, 5),
    ("Марина Егорова", "Декоратор", 90, 4),
    ("Дмитрий Орлов", "Столяр-краснодеревщик", 900, 12),
    ("Наталья Белова", "Флорист", 30, 3),
    ("Сергей Волков", "Монтажник декора", 200, 6),
    ("Ольга Морозова", "Менеджер салона", 90, 7),
    ("Павел Лебедев", "Менеджер по продажам", 60, 2),
    ("Екатерина Новикова", "Швея по текстилю и шторам", 500, 9),
    ("Андрей Захаров", "Обойщик мебели", 150, 5),
    ("Юлия Тарасова", "Администратор", 45, 1),
    ("Виктор Фёдоров", "Кладовщик", 300, 4),
    ("Анна Кузнецова", "Бухгалтер", 1200, 15),
    ("Роман Никитин", "Маркетолог", 30, 3),
    ("Светлана Попова", "Закупщик", 90, 6),
]

DEMO_SURVEY_TITLE = "Опрос вовлечённости (демо)"

DEMO_BLOCKS = [
    {
        "title": "Рабочее место и условия",
        "order": 0,
        "questions": [
            {
                "type": Question.Type.SINGLE,
                "order": 0,
                "text": "Насколько вы довольны своим рабочим местом?",
                "options": [
                    {"id": "s5", "text": "Полностью доволен"},
                    {"id": "s4", "text": "Скорее доволен"},
                    {"id": "s3", "text": "Нейтрально"},
                    {"id": "s2", "text": "Скорее не доволен"},
                    {"id": "s1", "text": "Совсем не доволен"},
                ],
            },
            {
                "type": Question.Type.MULTIPLE,
                "order": 1,
                "text": "Что стоит улучшить в первую очередь?",
                "options": [
                    {"id": "m1", "text": "Освещение"},
                    {"id": "m2", "text": "Инструменты и оборудование"},
                    {"id": "m3", "text": "График работы"},
                    {"id": "m4", "text": "Коммуникация в команде"},
                    {"id": "m5", "text": "Обучение и развитие"},
                ],
            },
        ],
    },
    {
        "title": "Обратная связь",
        "order": 1,
        "questions": [
            {
                "type": Question.Type.TEXTAREA,
                "order": 0,
                "text": "Что бы вы предложили изменить в компании?",
                "options": [],
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seed demo employees and a demo survey (idempotent). Run seed_initial_data first."

    def handle(self, *args, **options):
        today = timezone.localdate()

        emp_created = 0
        for full_name, specialty_name, days, experience in EMPLOYEES:
            specialty = Specialty.objects.filter(name=specialty_name).first()
            if specialty is None:
                specialty, _ = Specialty.objects.get_or_create(name=specialty_name)
            _, created = Employee.objects.get_or_create(
                full_name=full_name,
                defaults={
                    "specialty": specialty,
                    "photo": "",
                    "hire_date": today - datetime.timedelta(days=days),
                    "work_experience": experience,
                },
            )
            emp_created += int(created)
        self.stdout.write(
            self.style.SUCCESS(
                f"Employees: {emp_created} created, {len(EMPLOYEES) - emp_created} existed."
            )
        )

        survey, created = Test.objects.get_or_create(
            title=DEMO_SURVEY_TITLE,
            defaults={
                "is_active": True,
                "is_admin_conducted": False,
                "is_after_application": False,
                "month": [],  # every month
                "test_days_from": 1,
                "test_days_to": 28,
            },
        )
        if created:
            for block_def in DEMO_BLOCKS:
                block = QuestionBlock.objects.create(
                    test=survey, order=block_def["order"], title=block_def["title"]
                )
                for q in block_def["questions"]:
                    Question.objects.create(
                        block=block,
                        type=q["type"],
                        order=q["order"],
                        text=q["text"],
                        options=q["options"],
                    )
            self.stdout.write(self.style.SUCCESS(f'Demo survey created: "{DEMO_SURVEY_TITLE}".'))
        else:
            self.stdout.write(f'Demo survey already exists: "{DEMO_SURVEY_TITLE}".')

        self.stdout.write(self.style.SUCCESS("Demo seed completed."))
