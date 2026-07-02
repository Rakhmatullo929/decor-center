from django.contrib import admin

from .models import Instruction


@admin.register(Instruction)
class InstructionAdmin(admin.ModelAdmin):
    list_display = ["title", "specialty", "generation_status", "last_generated_at", "created_at"]
    list_filter = ["specialty", "generation_status"]
    search_fields = ["title"]
