from django.urls import path
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from .views import LoginView, MeView

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    # Blacklists the submitted refresh token so it cannot be replayed after logout.
    path("logout/", TokenBlacklistView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
]
