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
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password

import os

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
def forgot_password(request):
    email = request.data.get("email")

    # Do NOT reveal if user exists
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {"message": "If the account exists, a reset link has been sent"},
            status=status.HTTP_200_OK,
        )

    token = PasswordResetTokenGenerator().make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))

    frontend_url = os.environ.get(
        "FRONTEND_URL",
        "https://brisk-olive-hr-dashboard.vercel.app"
    )
    reset_link = f"{frontend_url}/reset-password/{uid}/{token}"

    send_mail(
        subject="Reset your password",
        message=f"Click the link to reset your password:\n\n{reset_link}",
        from_email=None,
        recipient_list=[email],
    )

    return Response({"message": "Password reset link sent"})


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    uid = request.data.get("uid")
    token = request.data.get("token")
    password = request.data.get("password")

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return Response(
            {"error": "Invalid reset link"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not PasswordResetTokenGenerator().check_token(user, token):
        return Response(
            {"error": "Token expired or invalid"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(password)
    user.save()

    return Response({"message": "Password reset successful"})


@api_view(["GET"])
@permission_classes([AllowAny])
def users_exist(request):
    exists = User.objects.exists()
    return Response({"exists": exists})


@api_view(["POST"])
@permission_classes([AllowAny])
def setup_user(request):
    # Only allow if no users exist
    if User.objects.exists():
        return Response({"error": "User already exists"}, status=status.HTTP_400_BAD_REQUEST)

    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response({"error": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already taken"}, status=status.HTTP_400_BAD_REQUEST)

    # Create user (hash password automatically)
    user = User.objects.create(
        username=username,
        password=make_password(password),
    )
    user.save()

    return Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)
