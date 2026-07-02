from django.contrib import admin

from .models import Employee, Specialty


@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name"]


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["full_name", "specialty", "hire_date", "work_experience", "is_active", "created_at"]
    list_filter = ["specialty", "is_active", "hire_date"]
    search_fields = ["full_name"]
