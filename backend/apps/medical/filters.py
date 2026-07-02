import datetime

import django_filters
from django.utils import timezone

from .models import MedicalCheck


def _day_range(value: datetime.date):
    """Return (start, end) timezone-aware datetimes covering the full local day."""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.datetime.combine(value, datetime.time.min), tz)
    end = timezone.make_aware(datetime.datetime.combine(value, datetime.time.max), tz)
    return start, end


class MedicalCheckFilter(django_filters.FilterSet):
    """History search: by employee, exact day, conclusion (SRS §7.4)."""

    date = django_filters.DateFilter(method="filter_exact_date")

    class Meta:
        model = MedicalCheck
        fields = ["employee", "conclusion"]

    def filter_exact_date(self, queryset, name, value):
        start, end = _day_range(value)
        return queryset.filter(created_at__range=(start, end))
