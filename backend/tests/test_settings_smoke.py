from django.conf import settings


def test_installed_apps_are_reduced():
    local = [a for a in settings.INSTALLED_APPS if a.startswith("apps.")]
    assert local == [
        "apps.core",
        "apps.accounts",
        "apps.employees",
        "apps.integrations",
        "apps.surveys",
    ]
    assert "apps.medical" not in settings.INSTALLED_APPS
    assert "apps.instructions" not in settings.INSTALLED_APPS
    assert "apps.assessments" not in settings.INSTALLED_APPS


def test_decor_dict_has_only_face_and_kiosk_keys():
    keys = set(settings.DECOR)
    assert keys == {
        "FACE_SIMILARITY_THRESHOLD",
        "FACE_RECOGNITION_BACKEND",
        "FACE_INSIGHTFACE_MODEL",
        "FACE_DET_SIZE",
        "FACE_MAX_PHOTOS_PER_EMPLOYEE",
        "FACE_MIN_FACE_PIXELS",
        "FACE_BLUR_MIN_VARIANCE",
        "ANTI_SPOOFING_BACKEND",
        "ANTI_SPOOFING_ENABLED",
        "ANTI_SPOOFING_THRESHOLD",
        "FACE_WARMUP_ON_STARTUP",
        "REVERIFY_ON_SUBMIT",
        "SURVEY_SESSION_ABANDONED_AFTER_HOURS",
        # Kiosk SMS OTP
        "SMS_BACKEND",
        "KIOSK_OTP_STATIC_CODE",
        "KIOSK_OTP_TTL_SECONDS",
        "KIOSK_OTP_MAX_ATTEMPTS",
    }
    # scoring / TTS / testgen knobs are gone
    for gone in ("QUESTIONS_PER_TEST", "PASS_THRESHOLD", "TESTGEN_LANGUAGE",
                 "TEST_GENERATOR_BACKEND", "TTS_VOICE_UZ", "UZBEKVOICE_API_KEY", "TTS_ASYNC"):
        assert gone not in settings.DECOR


def test_reverify_default_off():
    assert settings.DECOR["REVERIFY_ON_SUBMIT"] == "off"
