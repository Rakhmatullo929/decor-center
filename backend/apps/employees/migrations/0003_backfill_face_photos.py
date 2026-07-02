from django.db import migrations


def forward(apps, schema_editor):
    from apps.employees.face_enrollment import backfill_legacy_samples

    Employee = apps.get_model("employees", "Employee")
    EmployeeFacePhoto = apps.get_model("employees", "EmployeeFacePhoto")
    backfill_legacy_samples(Employee, EmployeeFacePhoto)


def backward(apps, schema_editor):
    EmployeeFacePhoto = apps.get_model("employees", "EmployeeFacePhoto")
    EmployeeFacePhoto.objects.filter(model_version="legacy").delete()


class Migration(migrations.Migration):
    dependencies = [("employees", "0002_employeefacephoto")]
    operations = [migrations.RunPython(forward, backward)]
