import datetime

import django_filters
from django.utils import timezone

from .models import TestSession


def _day_range(value: datetime.date):
    """Return (start, end) timezone-aware datetimes covering the full local day."""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.datetime.combine(value, datetime.time.min), tz)
    end = timezone.make_aware(datetime.datetime.combine(value, datetime.time.max), tz)
    return start, end


class TestSessionFilter(django_filters.FilterSet):
    """Results list filters including exact-day date filter (SRS §8.1)."""

    date = django_filters.DateFilter(method="filter_exact_date")

    class Meta:
        model = TestSession
        fields = ["employee", "module", "specialty", "passed"]

    def filter_exact_date(self, queryset, name, value):
        start, end = _day_range(value)
        return queryset.filter(started_at__range=(start, end))
