from apps.integrations import base, mocks, registry


def test_test_generator_port_is_removed():
    assert not hasattr(base, "TestGeneratorService")
    assert not hasattr(base, "GeneratedQuestion")
    assert not hasattr(mocks, "MockTestGeneratorService")
    assert not hasattr(registry, "get_test_generator_service")


def test_face_pipeline_intact():
    assert hasattr(registry, "get_face_recognition_service")
    assert hasattr(registry, "get_anti_spoofing_service")
    assert hasattr(base, "NoFaceDetectedError")
    assert hasattr(base, "DetectedFace")
    svc = registry.get_face_recognition_service()
    for method in ("compare", "extract_embedding", "compare_embeddings", "identify_best_match", "detect", "warmup"):
        assert hasattr(svc, method)
