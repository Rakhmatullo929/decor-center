import pytest
from django.core.management import call_command

from apps.surveys.models import Test

pytestmark = pytest.mark.django_db


def test_seed_surveys_creates_presets():
    call_command("seed_surveys")
    assert Test.objects.count() == 5
    after_30 = Test.objects.get(title="Через 30 дней после найма")
    assert after_30.is_after_application is True
    assert after_30.after_days == 30
    one_on_one = Test.objects.get(title="1в1 ежемесячно (беседа)")
    assert one_on_one.is_admin_conducted is True
    assert one_on_one.month == []
    pulse = Test.objects.get(title="Краткий пульс")
    assert pulse.month == [1, 4, 7, 10]
    assert pulse.test_days_from == 1
    assert pulse.test_days_to == 7


def test_seed_surveys_is_idempotent():
    call_command("seed_surveys")
    call_command("seed_surveys")
    assert Test.objects.count() == 5
