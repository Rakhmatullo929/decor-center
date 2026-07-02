import pytest
from django.core.management import call_command

from apps.accounts.models import User
from apps.employees.models import Specialty

pytestmark = pytest.mark.django_db


def test_seed_creates_admin_and_specialist_only():
    call_command("seed_initial_data")
    usernames = set(User.objects.values_list("username", flat=True))
    assert usernames == {"admin", "specialist"}
    assert not User.objects.filter(username="medic").exists()
    admin = User.objects.get(username="admin")
    assert admin.is_superuser and admin.is_staff and admin.role == "admin"
    specialist = User.objects.get(username="specialist")
    assert specialist.role == "specialist"
    assert Specialty.objects.count() > 0


def test_seed_is_idempotent():
    call_command("seed_initial_data")
    call_command("seed_initial_data")
    assert User.objects.filter(username="admin").count() == 1
