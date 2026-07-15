from django.db import transaction
from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrReadOnly

from .face_enrollment import add_face_photo, recompute_centroid
from .models import Employee, EmployeeFacePhoto, Specialty
from .serializers import (
    EmployeeFacePhotoSerializer,
    EmployeeSerializer,
    SpecialtySerializer,
)
from .services import delete_employee_with_related


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

    queryset = Employee.objects.select_related("specialty")
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
                {"code": ["invalid_image"], "photo": ["No photo was provided."]},
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
