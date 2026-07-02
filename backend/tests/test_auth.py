import pytest

from .factories import UserFactory

pytestmark = pytest.mark.django_db

LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
ME_URL = "/api/v1/auth/me/"


def test_login_returns_tokens_role_and_permissions(api_client):
    UserFactory(username="medic1", role="medic")
    response = api_client.post(LOGIN_URL, {"username": "medic1", "password": "password123"})
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data
    assert response.data["user"]["role"] == "medic"
    assert "medical:write" in response.data["user"]["permissions"]
    assert "questions:write" not in response.data["user"]["permissions"]


def test_login_wrong_password_rejected(api_client):
    UserFactory(username="medic1", role="medic")
    response = api_client.post(LOGIN_URL, {"username": "medic1", "password": "wrong"})
    assert response.status_code == 401


def test_refresh_token_flow(api_client):
    UserFactory(username="admin1", role="admin")
    login = api_client.post(LOGIN_URL, {"username": "admin1", "password": "password123"})
    response = api_client.post(REFRESH_URL, {"refresh": login.data["refresh"]})
    assert response.status_code == 200
    assert "access" in response.data


def test_me_returns_current_user(admin_client, admin_user):
    response = admin_client.get(ME_URL)
    assert response.status_code == 200
    assert response.data["username"] == admin_user.username
    assert response.data["role"] == "admin"
    assert "employees:write" in response.data["permissions"]


def test_logout_blacklists_refresh_token(api_client):
    UserFactory(username="admin1", role="admin")
    login = api_client.post(LOGIN_URL, {"username": "admin1", "password": "password123"})
    refresh = login.data["refresh"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    assert api_client.post(LOGOUT_URL, {"refresh": refresh}).status_code == 200
    # The blacklisted refresh token must no longer be usable.
    assert api_client.post(REFRESH_URL, {"refresh": refresh}).status_code == 401


def test_me_requires_authentication(api_client):
    assert api_client.get(ME_URL).status_code == 401
