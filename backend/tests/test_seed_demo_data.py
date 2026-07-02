"""Demo data seed: enough approved questions per module, idempotent re-runs."""
import pytest
from django.core.management import call_command

from apps.assessments.models import Module, Question, TestSession
from apps.employees.models import Employee
from apps.medical.models import MedicalCheck


@pytest.fixture
def seeded(db):
    call_command("seed_initial_data")
    call_command("seed_demo_data")


def test_every_module_has_enough_approved_questions(seeded):
    approved = Question.objects.filter(status=Question.Status.APPROVED)
    assert approved.filter(module=Module.TECH_SAFETY).count() >= 10
    assert approved.filter(module=Module.INDUSTRIAL_SAFETY).count() >= 10
    for specialty_name in ["Engine driver (machinist)", "Assistant engine driver"]:
        assert (
            approved.filter(module=Module.SPECIALTY, specialty__name=specialty_name).count() >= 10
        )


def test_demo_employees_have_photo_and_embedding(seeded):
    employees = Employee.objects.all()
    assert employees.count() >= 8
    for employee in employees:
        assert employee.photo
        assert employee.face_embedding  # mock backend extracts from the seeded photo


def test_finished_sessions_are_consistent(seeded):
    sessions = TestSession.objects.all()
    assert sessions.exists()
    for session in sessions:
        assert session.finished_at is not None
        assert session.answers.count() == session.total
        assert session.answers.filter(is_correct=True).count() == session.score
        if session.module == Module.SPECIALTY:
            assert session.specialty == session.employee.specialty


def test_seed_is_idempotent(seeded):
    counts = (
        Question.objects.count(),
        Employee.objects.count(),
        TestSession.objects.count(),
        MedicalCheck.objects.count(),
    )
    call_command("seed_demo_data")
    assert counts == (
        Question.objects.count(),
        Employee.objects.count(),
        TestSession.objects.count(),
        MedicalCheck.objects.count(),
    )
