from django.db import transaction
from django.db.models import Exists, OuterRef, ProtectedError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.permissions import IsAdmin, IsAdminOrReadOnly

from .face_enrollment import add_face_photo, recompute_centroid
from .models import Employee, EmployeeFacePhoto, EmployeeInvite, Specialty
from .serializers import (
    EmployeeFacePhotoSerializer,
    EmployeeInviteCreateSerializer,
    EmployeeSerializer,
    SpecialtySerializer,
)
from .services import (
    create_employee_invite,
    delete_employee_with_related,
    get_invite_by_token,
)


class SpecialtyViewSet(viewsets.ModelViewSet):
    """Specialties: read for all authenticated roles, write for admin (SRS §8.1)."""

    queryset = Specialty.objects.all()
    serializer_class = SpecialtySerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["is_active"]
    search_fields = ["name"]

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ValidationError(
                {"detail": "Нельзя удалить специальность: к ней привязаны сотрудники, инструкции или тесты."}
            ) from exc


class EmployeeViewSet(viewsets.ModelViewSet):
    """Employees: read (selection screens) for all roles, write for admin (SRS §4, §8.1)."""

    queryset = Employee.objects.select_related("specialty").annotate(
        is_self_registered=Exists(
            EmployeeInvite.objects.filter(employee=OuterRef("pk"))
        )
    )
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["specialty", "is_active"]
    search_fields = ["full_name"]
    ordering_fields = ["full_name", "hire_date", "created_at"]

    def perform_destroy(self, instance):
        """Hard-delete the employee and cascade their survey history (admin only)."""
        try:
            delete_employee_with_related(instance)
        except ProtectedError as exc:
            raise ValidationError(
                {"detail": "Нельзя удалить сотрудника: остались связанные записи."}
            ) from exc

    @action(detail=True, methods=["get", "post"], url_path="face-photos")
    def face_photos(self, request, pk=None):
        """List an employee's face samples (GET) or add one (POST, admin only)."""
        employee = self.get_object()
        if request.method == "GET":
            serializer = EmployeeFacePhotoSerializer(
                employee.face_photos.all(), many=True, context={"request": request}
            )
            return Response(serializer.data)

        upload = request.FILES.get("photo")
        if upload is None:
            return Response(
                {
                    "detail": "No photo was provided.",
                    "code": ["invalid_image"],
                    "photo": ["No photo was provided."],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        upload.seek(0)
        image_bytes = upload.read()
        sample = add_face_photo(employee, image_bytes, upload.name, user=request.user)
        serializer = EmployeeFacePhotoSerializer(sample, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"face-photos/(?P<photo_id>[^/.]+)",
    )
    def delete_face_photo(self, request, pk=None, photo_id=None):
        """Delete one face sample (admin only) and recompute the centroid.

        The row deletion and centroid recompute run in one transaction; the storage
        file is removed only after that transaction commits, so a mid-operation failure
        never leaves a row pointing at a missing file or a stale centroid.
        """
        employee = self.get_object()
        try:
            sample = employee.face_photos.get(pk=photo_id)
        except EmployeeFacePhoto.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        photo_file = sample.photo
        with transaction.atomic():
            sample.delete()
            recompute_centroid(employee)
            transaction.on_commit(lambda: photo_file.delete(save=False))
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmployeeInviteViewSet(viewsets.GenericViewSet):
    """One-time employee self-registration invites.

    - create   POST /employee-invites/            admin only  -> {token, expires_at}
    - validate GET  /employee-invites/validate/   public      -> {valid, reason, specialty_name}
    - register POST /employee-invites/register/    public      -> 201 {status: "pending"}
    """

    queryset = EmployeeInvite.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    _THROTTLE_SCOPES = {"validate": "invite_validate", "register": "invite_register"}

    def get_permissions(self):
        if self.action in ("validate", "register"):
            return [AllowAny()]
        return [IsAdmin()]

    def get_throttles(self):
        scope = self._THROTTLE_SCOPES.get(self.action)
        if scope:
            self.throttle_scope = scope
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def create(self, request):
        serializer = EmployeeInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite, raw_token = create_employee_invite(
            specialty=serializer.validated_data["specialty"],
            created_by=request.user,
        )
        return Response(
            {"token": raw_token, "expires_at": invite.expires_at},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"])
    def validate(self, request):
        invite = get_invite_by_token(request.query_params.get("token") or "")
        if invite is None:
            return Response({"valid": False, "reason": "not_found"})
        if invite.is_used:
            return Response({"valid": False, "reason": "used"})
        if invite.is_expired():
            return Response({"valid": False, "reason": "expired"})
        return Response(
            {"valid": True, "reason": "ok", "specialty_name": invite.specialty.name}
        )

    @action(detail=False, methods=["post"])
    def register(self, request):
        invite = get_invite_by_token(request.data.get("token") or "")
        if invite is None or not invite.is_valid():
            return Response(
                {"detail": "Invite link is invalid or already used.", "code": "invite_invalid"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = {
            "full_name": request.data.get("full_name"),
            "phone": request.data.get("phone"),
            "specialty": invite.specialty_id,
            "is_active": False,
            "photo": request.FILES.get("photo"),
        }
        work_experience = request.data.get("work_experience")
        if work_experience not in (None, ""):
            data["work_experience"] = work_experience

        # No request in context -> face-photo created_by resolves to None (anonymous).
        serializer = EmployeeSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            employee = serializer.save()
            invite.is_used = True
            invite.used_at = timezone.now()
            invite.employee = employee
            invite.save(update_fields=["is_used", "used_at", "employee", "updated_at"])
        return Response({"status": "pending"}, status=status.HTTP_201_CREATED)
