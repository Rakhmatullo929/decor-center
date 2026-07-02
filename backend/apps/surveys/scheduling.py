"""Compute which surveys are 'due' for an employee on a given day (spec §4.2)."""
import calendar
import datetime

from .models import SurveySession, Test

ALL_MONTHS = list(range(1, 13))


def _last_day_of_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


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

    for test in Test.objects.filter(is_active=True, is_admin_conducted=False):
        if test.is_after_application:
            if days is None or test.after_days is None:
                continue
            if days >= test.after_days and not _completed_ever(test, employee):
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
            if not _completed_since(test, employee, window_start):
                result.append(test)
    return result
