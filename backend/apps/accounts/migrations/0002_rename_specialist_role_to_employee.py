from django.db import migrations, models


def specialist_to_employee(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="specialist").update(role="employee")


def employee_to_specialist(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="employee").update(role="specialist")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[("admin", "Administrator"), ("employee", "Сотрудник")],
                default="employee",
                max_length=20,
            ),
        ),
        migrations.RunPython(specialist_to_employee, employee_to_specialist),
    ]
