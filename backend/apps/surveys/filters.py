import django_filters

from .models import SurveySession


class SurveySessionFilter(django_filters.FilterSet):
    class Meta:
        model = SurveySession
        fields = ["employee", "test"]
