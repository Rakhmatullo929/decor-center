"""API v1 routing: all module endpoints under /api/v1/."""
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.core.views import DashboardStatsView
from apps.employees.views import EmployeeViewSet, SpecialtyViewSet

router = DefaultRouter()
router.register("specialties", SpecialtyViewSet, basename="specialty")
router.register("employees", EmployeeViewSet, basename="employee")

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    *router.urls,
]
