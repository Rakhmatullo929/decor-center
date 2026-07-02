from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import serializers

from .face_enrollment import add_face_photo
from .models import Employee, EmployeeFacePhoto, Specialty


class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = ["id", "name", "is_active", "created_at"]
        read_only_fields = ["created_at"]


class EmployeeSerializer(serializers.ModelSerializer):
    specialty_name = serializers.CharField(source="specialty.name", read_only=True)

    class Meta:
        model = Employee
        # face_embedding is intentionally excluded — internal data.
        fields = [
            "id",
            "full_name",
            "specialty",
            "specialty_name",
            "photo",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def _current_user(self):
        request = self.context.get("request")
        return getattr(request, "user", None) if request is not None else None

    @staticmethod
    def _read_upload(photo) -> tuple[bytes, str]:
        """Read the uploaded file fully into memory BEFORE any storage write.

        Returns (bytes, filename). Reading up front avoids relying on the upload
        stream still being open/rewindable after Django has saved/moved it (large
        uploads use a temp-file handler that may be moved on save).
        """
        photo.seek(0)
        data = photo.read()
        photo.seek(0)
        return data, (getattr(photo, "name", None) or "photo.png")

    def _seed_display_photo(self, employee, image_bytes: bytes, filename: str) -> None:
        """Validate the display photo and persist it as a sample, then write the file.

        The enrollment gates run on the in-memory bytes first; only if they pass do we
        write the display photo to storage — so a rejected photo leaves no orphan file.
        The implicit display sample is exempt from the per-employee photo cap
        (``enforce_limit=False``) so editing the display photo is never blocked.
        """
        add_face_photo(
            employee,
            image_bytes,
            filename,
            user=self._current_user(),
            enforce_limit=False,
        )
        employee.photo.save(filename, ContentFile(image_bytes), save=True)

    def create(self, validated_data):
        image_bytes, filename = self._read_upload(validated_data.pop("photo"))
        with transaction.atomic():
            employee = super().create({**validated_data, "face_embedding": None})
            self._seed_display_photo(employee, image_bytes, filename)
        employee.refresh_from_db()
        return employee

    def update(self, instance, validated_data):
        photo = validated_data.pop("photo", None)
        with transaction.atomic():
            employee = super().update(instance, validated_data)
            if photo is not None:
                image_bytes, filename = self._read_upload(photo)
                self._seed_display_photo(employee, image_bytes, filename)
        employee.refresh_from_db()
        return employee


class EmployeeFacePhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeFacePhoto
        # embedding is intentionally excluded — internal data.
        fields = ["id", "photo", "model_version", "created_at"]
        read_only_fields = fields
