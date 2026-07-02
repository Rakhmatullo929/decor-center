import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.assessments.models import Question
from apps.instructions.models import Instruction

from .factories import SpecialtyFactory

pytestmark = pytest.mark.django_db

INSTRUCTIONS_URL = "/api/v1/instructions/"


def _upload(admin_client, specialty):
    file = SimpleUploadedFile(
        "instruction.txt", b"Locomotive braking procedure ...", "text/plain"
    )
    return admin_client.post(
        INSTRUCTIONS_URL,
        {"specialty": specialty.id, "title": "Braking instruction", "file": file},
        format="multipart",
    )


def test_admin_uploads_instruction(admin_client):
    specialty = SpecialtyFactory()
    response = _upload(admin_client, specialty)
    assert response.status_code == 201, response.data
    assert response.data["generation_status"] == "not_started"


def test_generate_creates_draft_ai_questions(admin_client):
    specialty = SpecialtyFactory()
    instruction_id = _upload(admin_client, specialty).data["id"]

    response = admin_client.post(
        f"{INSTRUCTIONS_URL}{instruction_id}/generate/", {"count": 5}, format="json"
    )
    assert response.status_code == 201, response.data
    assert response.data["created"] == 5

    questions = Question.objects.filter(specialty=specialty)
    assert questions.count() == 5
    assert all(q.status == Question.Status.DRAFT for q in questions)
    assert all(q.source == Question.Source.AI for q in questions)
    assert all(len(q.options) == 4 for q in questions)

    instruction = Instruction.objects.get(id=instruction_id)
    assert instruction.generation_status == Instruction.GenerationStatus.COMPLETED
    assert instruction.last_generated_at is not None


def test_instructions_are_admin_only(specialist_client, medic_client):
    assert specialist_client.get(INSTRUCTIONS_URL).status_code == 403
    assert medic_client.get(INSTRUCTIONS_URL).status_code == 403
