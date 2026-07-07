"""Seed the real bilingual question content (blocks + questions) for the 5 standard
surveys created by `seed_surveys`. Idempotent: a survey already holding blocks is
left untouched, so re-running never duplicates or overwrites admin edits.

Run after `seed_surveys` (which only creates the `Test` shell — schedule, no content).
"""
from django.core.management.base import BaseCommand

from apps.surveys.models import Question, QuestionBlock, Test

from ._survey_content_data import SURVEYS_CONTENT


class Command(BaseCommand):
    help = "Seed real block/question content for the 5 standard surveys (idempotent)."

    def handle(self, *args, **options):
        seeded = 0
        skipped = 0
        for survey_def in SURVEYS_CONTENT:
            title = survey_def["test_title"]
            test = Test.objects.filter(title=title).first()
            if test is None:
                self.stdout.write(self.style.WARNING(f'Survey not found, skipped: "{title}"'))
                continue
            if test.blocks.exists():
                skipped += 1
                continue

            for block_order, block_def in enumerate(survey_def["blocks"]):
                block = QuestionBlock.objects.create(
                    test=test, order=block_order, title=block_def["title"]
                )
                questions = [
                    Question(
                        block=block,
                        order=q_order,
                        type=q["type"],
                        text=q["text"],
                        options=q.get("options", []),
                        settings=q.get("settings", {}),
                        is_required=q.get("is_required", False),
                        is_mind_dive=q.get("is_mind_dive", False),
                    )
                    for q_order, q in enumerate(block_def["questions"])
                ]
                Question.objects.bulk_create(questions)
            seeded += 1
            self.stdout.write(self.style.SUCCESS(f'Content seeded: "{title}"'))

        self.stdout.write(
            self.style.SUCCESS(f"seed_survey_content: {seeded} seeded, {skipped} already had content.")
        )
