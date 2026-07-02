from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin
from apps.assessments.models import Module, Question
from apps.integrations.registry import get_test_generator_service

from .models import Instruction
from .serializers import GenerateQuestionsSerializer, InstructionSerializer
from .services import extract_instruction_text


class InstructionViewSet(viewsets.ModelViewSet):
    """Instruction management + AI generation trigger — admin only (SRS §8.1)."""

    queryset = Instruction.objects.select_related("specialty")
    serializer_class = InstructionSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["specialty", "generation_status"]
    search_fields = ["title"]
    ordering_fields = ["created_at", "title"]

    @extend_schema(request=GenerateQuestionsSerializer)
    @action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        """Generate draft questions from this instruction via the AI service (SRS §12.1)."""
        instruction = self.get_object()
        serializer = GenerateQuestionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = serializer.validated_data["count"]
        language = serializer.validated_data.get("language") or settings.DEPO["TESTGEN_LANGUAGE"]

        generator = get_test_generator_service()
        try:
            source_text = extract_instruction_text(instruction.file)
            generated = generator.generate(source_text=source_text, count=count, language=language)
        except Exception:
            instruction.generation_status = Instruction.GenerationStatus.FAILED
            instruction.save(update_fields=["generation_status", "updated_at"])
            raise

        Question.objects.bulk_create(
            [
                Question(
                    module=Module.SPECIALTY,
                    specialty=instruction.specialty,
                    text=item.text,
                    options=item.options,
                    correct_option=item.correct_option,
                    source=Question.Source.AI,
                    status=Question.Status.DRAFT,
                )
                for item in generated
            ]
        )
        instruction.generation_status = Instruction.GenerationStatus.COMPLETED
        instruction.last_generated_at = timezone.now()
        instruction.save(update_fields=["generation_status", "last_generated_at", "updated_at"])

        return Response({"created": len(generated)}, status=status.HTTP_201_CREATED)
