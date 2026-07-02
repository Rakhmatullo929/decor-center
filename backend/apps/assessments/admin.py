from django.contrib import admin

from .models import FaceVerificationLog, Question, TestAnswer, TestSession


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["text_short", "module", "specialty", "source", "status", "created_at"]
    list_filter = ["module", "status", "source", "specialty"]
    search_fields = ["text"]

    @admin.display(description="Question")
    def text_short(self, obj):
        return obj.text[:80]


class TestAnswerInline(admin.TabularInline):
    model = TestAnswer
    extra = 0
    readonly_fields = ["question", "selected_option", "is_correct"]
    can_delete = False


@admin.register(TestSession)
class TestSessionAdmin(admin.ModelAdmin):
    list_display = ["employee", "module", "score", "total", "passed", "face_verified", "started_at"]
    list_filter = ["module", "passed", "face_verified"]
    search_fields = ["employee__full_name"]
    inlines = [TestAnswerInline]


@admin.register(FaceVerificationLog)
class FaceVerificationLogAdmin(admin.ModelAdmin):
    list_display = ["employee", "success", "similarity_score", "created_at"]
    list_filter = ["success"]
    search_fields = ["employee__full_name"]
