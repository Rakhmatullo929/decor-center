"""API v1 routing: all module endpoints under /api/v1/."""
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.assessments.views import QuestionViewSet, TestSessionViewSet
from apps.core.views import DashboardStatsView
from apps.employees.views import EmployeeViewSet, SpecialtyViewSet
from apps.instructions.views import InstructionViewSet
from apps.medical.views import MedicalCheckViewSet

router = DefaultRouter()
router.register("specialties", SpecialtyViewSet, basename="specialty")
router.register("employees", EmployeeViewSet, basename="employee")
router.register("instructions", InstructionViewSet, basename="instruction")
router.register("questions", QuestionViewSet, basename="question")
router.register("test-sessions", TestSessionViewSet, basename="test-session")
router.register("medical-checks", MedicalCheckViewSet, basename="medical-check")

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    *router.urls,
]
