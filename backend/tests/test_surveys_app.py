from django.apps import apps


def test_surveys_app_is_installed():
    assert apps.is_installed("apps.surveys")
    config = apps.get_app_config("surveys")
    assert config.name == "apps.surveys"
