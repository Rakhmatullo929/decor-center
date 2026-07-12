"""Compute which surveys are 'due' for an employee on a given day (spec §4.2)."""
import calendar
import datetime

from django.conf import settings as django_settings
from django.utils import timezone

from .models import SurveySession, Test

ALL_MONTHS = list(range(1, 13))


def _last_day_of_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def is_expired(test: Test, today: datetime.date) -> bool:
    """True when a periodic survey's explicit day-of-month window has already
    passed this month, i.e. a late start/submit must be refused (read-only).

    Lenient by design: after-application surveys and periodic surveys without an
    explicit upper bound (`test_days_to is None`) never expire — there is no
    deadline to pass. Visibility windowing (which day a survey first appears) is
    handled separately by `due_surveys`; this governs only whether a late
    start/submit is still allowed.
    """
    if test.is_after_application or test.test_days_to is None:
        return False
    months = test.month or ALL_MONTHS
    if today.month not in months:
        return False
    hi = min(test.test_days_to, _last_day_of_month(today.year, today.month))
    return today.day > hi


def _completed_ever(test: Test, employee) -> bool:
    return SurveySession.objects.filter(
        test=test, employee=employee, completed_at__isnull=False
    ).exists()


def _completed_since(test: Test, employee, window_start: datetime.date) -> bool:
    return SurveySession.objects.filter(
        test=test,
        employee=employee,
        completed_at__isnull=False,
        completed_at__date__gte=window_start,
    ).exists()


def due_surveys(employee, today: datetime.date) -> list[Test]:
    """Return active, non-admin-conducted surveys currently due for `employee`.

    - after_application: one-shot once `days_since_hire >= after_days`; suppressed forever
      once completed.
    - periodic: due when `today.month` is in `month` ([] => every month) and `today.day`
      falls inside `test_days_from..test_days_to` (upper bound clamped to the month's last
      day); suppressed once completed within the current month's window.
    """
    hire = employee.hire_date
    days = None if hire is None else (today - hire).days
    result: list[Test] = []

    # Surveys with a live (not completed, not abandoned) session belong in the
    # "continue"/in-progress list, not "due" — excluding them here removes the
    # duplicate-row bug. Cutoff mirrors services._live_session_cutoff (kept inline
    # so scheduling stays independent of the service layer).
    live_cutoff = timezone.now() - datetime.timedelta(
        hours=django_settings.DECOR["SURVEY_SESSION_ABANDONED_AFTER_HOURS"]
    )
    live_test_ids = set(
        SurveySession.objects.filter(
            employee=employee, completed_at__isnull=True, started_at__gte=live_cutoff
        ).values_list("test_id", flat=True)
    )

    for test in Test.objects.filter(is_active=True, is_admin_conducted=False):
        if test.is_after_application:
            if days is None or test.after_days is None:
                continue
            if (
                days >= test.after_days
                and test.id not in live_test_ids
                and not _completed_ever(test, employee)
            ):
                result.append(test)
        else:
            months = test.month or ALL_MONTHS
            if today.month not in months:
                continue
            lo = test.test_days_from or 1
            hi = min(
                test.test_days_to or lo,
                _last_day_of_month(today.year, today.month),
            )
            if not (lo <= today.day <= hi):
                continue
            window_start = datetime.date(today.year, today.month, lo)
            if test.id not in live_test_ids and not _completed_since(
                test, employee, window_start
            ):
                result.append(test)
    return result
