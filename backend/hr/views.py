from rest_framework import generics, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth.models import User

from google.oauth2 import id_token
from google.auth.transport import requests

from .models import CandidateApplication, Country, State, City, Employee
from .serializers import (
    CandidateApplicationSerializer,
    CountrySerializer,
    StateSerializer,
    CitySerializer,
    EmployeeSerializer,
    CustomTokenObtainPairSerializer,
)
from .permissions import IsInGroup


class EmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Employee.objects.all().prefetch_related('contracts', 'payslips')
    serializer_class = EmployeeSerializer
    permission_classes = [AllowAny]


class CountryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer
    permission_classes = [AllowAny]


class StateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = State.objects.all()
    serializer_class = StateSerializer
    permission_classes = [AllowAny]


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['state']
    permission_classes = [AllowAny]


class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class CandidateApplicationListCreate(generics.ListCreateAPIView):
    queryset = CandidateApplication.objects.order_by('-created_at')
    serializer_class = CandidateApplicationSerializer
    permission_classes = [AllowAny]


class CandidateApplicationRetrieveUpdate(generics.RetrieveUpdateAPIView):
    queryset = CandidateApplication.objects.all()
    serializer_class = CandidateApplicationSerializer
    permission_classes = [AllowAny]  # or restrict if needed


class CandidateApplicationView(APIView):
    permission_classes = [IsInGroup(["Outsider", "HR", "Admin"])]

    def get(self, request):
        return Response({"message": "Candidate application form accessible"})


class HiringRequisitionView(APIView):
    permission_classes = [IsInGroup(["HR", "Admin"])]

    def get(self, request):
        return Response({"message": "Hiring requisition accessible"})


@api_view(["POST"])
@permission_classes([AllowAny])
def google_login(request):
    token = request.data.get("token")
    if not token:
        return Response(
            {"error": "Token not provided"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            "640334461086-14msfhrn9sq8b75ena8f5q5ogn38o0pa.apps.googleusercontent.com"
        )
        email = idinfo["email"]

        user, _ = User.objects.get_or_create(
            username=email,
            defaults={"email": email}
        )

        refresh = RefreshToken.for_user(user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "role": "employee"
        })

    except Exception as e:
        print("GOOGLE ERROR:", str(e))
        return Response(
            {"error": "Google token verification failed"},
            status=status.HTTP_400_BAD_REQUEST
        )