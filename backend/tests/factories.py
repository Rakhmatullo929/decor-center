import factory
from factory.django import DjangoModelFactory

from apps.accounts.models import Roles, User
from apps.employees.models import Employee, Specialty


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    role = Roles.EMPLOYEE
    password = factory.django.Password("password123")


class SpecialtyFactory(DjangoModelFactory):
    class Meta:
        model = Specialty

    name = factory.Sequence(lambda n: f"Specialty {n}")


def _canonical_face_embedding():
    """Embedding of the canonical test photo (the `face_image` fixture's bytes).

    The mock matches by embedding identity, so a factory employee's stored embedding must
    equal the embedding of that same photo for the Face ID happy-path tests to match — and
    so that enrolling that same photo onto another employee is correctly seen as a duplicate.
    Imported lazily to avoid a conftest <-> factories import cycle.
    """
    from apps.integrations.mocks import MockFaceRecognitionService

    from .conftest import png_bytes

    return MockFaceRecognitionService().extract_embedding(png_bytes())


class EmployeeFactory(DjangoModelFactory):
    class Meta:
        model = Employee

    full_name = factory.Sequence(lambda n: f"Employee Test {n}")
    specialty = factory.SubFactory(SpecialtyFactory)
    photo = factory.django.ImageField(filename="face.png")
    # Reference embedding normally generated on photo upload via the API.
    face_embedding = factory.LazyFunction(_canonical_face_embedding)
    is_active = True


# --- surveys ---
from apps.surveys.models import Question, QuestionBlock, SurveySession, Test  # noqa: E402


class TestFactory(DjangoModelFactory):
    __test__ = False  # not a pytest test class despite the name

    class Meta:
        model = Test

    title = factory.Sequence(lambda n: f"Survey {n}")
    is_active = True


class QuestionBlockFactory(DjangoModelFactory):
    class Meta:
        model = QuestionBlock

    test = factory.SubFactory(TestFactory)
    order = 0
    title = factory.Sequence(lambda n: f"Block {n}")


class QuestionFactory(DjangoModelFactory):
    class Meta:
        model = Question

    block = factory.SubFactory(QuestionBlockFactory)
    type = Question.Type.SINGLE
    text = factory.Sequence(lambda n: f"Question {n}?")
    options = factory.LazyFunction(
        lambda: [{"id": "a", "text": "Yes"}, {"id": "b", "text": "No"}]
    )
    order = 0


class SurveySessionFactory(DjangoModelFactory):
    class Meta:
        model = SurveySession

    test = factory.SubFactory(TestFactory)
    employee = factory.SubFactory(EmployeeFactory)
