from rest_framework import generics
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import DecorTokenObtainPairSerializer, MeSerializer


class LoginView(TokenObtainPairView):
    serializer_class = DecorTokenObtainPairSerializer


class MeView(generics.RetrieveAPIView):
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user
