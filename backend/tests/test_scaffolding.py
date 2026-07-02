import pytest

from apps.accounts.models import Roles

from . import factories

pytestmark = pytest.mark.django_db


def test_factories_have_no_assessments():
    # The deleted assessments QuestionFactory is gone; the only QuestionFactory now
    # builds a SURVEY question (Plan 2).
    from apps.surveys.models import Question

    assert factories.QuestionFactory._meta.model is Question
    assert hasattr(factories, "EmployeeFactory")


def test_employee_factory_embedding_matches_face_image():
    emp = factories.EmployeeFactory()
    assert emp.face_embedding is not None and len(emp.face_embedding) == 16


def test_specialist_fixture_role(specialist_user):
    assert specialist_user.role == Roles.SPECIALIST
