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
from rest_framework.filters import SearchFilter

from .models import CTCComponent, Department, Designation, HiringRequisition
from .serializers import CTCComponentSerializer, DepartmentSerializer, DesignationSerializer, HiringRequisitionSerializer

from django.contrib.auth.models import User
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
from django.core.mail import send_mail
from django.utils.crypto import get_random_string
from django.conf import settings

from .utils import calculate_breakdown
from .models import Contract, UserProfile, OTP
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
import random

import os

from .models import CandidateApplication, Country, State, City, Employee
from .serializers import (
    CandidateApplicationSerializer,
    ContractSerializer,
    CountrySerializer,
    StateSerializer,
    CitySerializer,
    EmployeeSerializer,
    CustomTokenObtainPairSerializer,
)
from .permissions import IsInGroup


class EmployeeViewSet(viewsets.ModelViewSet):
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
    
class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer

    def perform_create(self, serializer):
        total_annual_ctc = serializer.validated_data['total_annual_ctc']
        manual_overrides = serializer.validated_data.get('manual_overrides', {})

        breakdown = calculate_breakdown(total_annual_ctc, manual_overrides)
        serializer.save(breakdown=breakdown)

    def perform_update(self, serializer):
        total_annual_ctc = serializer.validated_data.get(
            'total_annual_ctc',
            serializer.instance.total_annual_ctc
        )
        manual_overrides = serializer.validated_data.get('manual_overrides', {})
        breakdown = calculate_breakdown(total_annual_ctc, manual_overrides)
        serializer.save(breakdown=breakdown)

class CTCComponentViewSet(viewsets.ModelViewSet):
    queryset = CTCComponent.objects.filter(is_active=True)
    serializer_class = CTCComponentSerializer
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["name", "code"]


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


class UsersExistView(APIView):
    def get(self, request):
        exists = User.objects.exists()
        return Response({'exists': exists})

class SetupUserView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, password=password)
        UserProfile.objects.get_or_create(user=user, defaults={'mobile': ''})  # Add empty profile
        user.is_superuser = True  # Make first user superuser
        user.is_staff = True
        user.save()
        return Response({'message': 'Superuser created successfully. You can now log in.'})

class ForgotPasswordView(APIView):
    def post(self, request):
        username = request.data.get('username')
        if not username:
            return Response({'error': 'Username required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(username=username)
            # Generate and send OTP
            otp = str(random.randint(100000, 999999))
            OTP.objects.filter(user=user).delete()  # Clear old OTPs
            otp_obj = OTP.objects.create(user=user, otp=otp)
            otp_obj.save()

            # Send OTP to email
            send_mail(
                'Password Reset OTP',
                f'Your OTP for password reset is: {otp}. It expires in 10 minutes.',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )

            # Get last 4 digits of mobile (from profile)
            profile = UserProfile.objects.get(user=user)
            last_4_mobile = profile.mobile[-4:] if profile.mobile else '****'

            return Response({
                'message': 'OTP sent to your email.',
                'last_4_mobile': last_4_mobile,
                'otp_hint': f'Your registered mobile ends with {last_4_mobile}.'
            })
        except User.DoesNotExist:
            return Response({'message': 'If user exists, OTP sent to email.'}, status=status.HTTP_200_OK)  # Security: don't reveal user existence

class OTPVerifyView(APIView):
    def post(self, request):
        username = request.data.get('username')
        otp = request.data.get('otp')
        if not username or not otp:
            return Response({'error': 'Username and OTP required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(username=username)
            otp_obj = OTP.objects.filter(user=user, otp=otp, used=False).first()
            if otp_obj and otp_obj.is_valid():
                otp_obj.used = True
                otp_obj.save()
                return Response({'message': 'OTP verified. You can now reset password.'})
            return Response({'error': 'Invalid or expired OTP'}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({'error': 'Invalid username or OTP'}, status=status.HTTP_400_BAD_REQUEST)

class ResetPasswordView(APIView):
    def post(self, request):
        username = request.data.get('username')
        new_password = request.data.get('password')
        if not username or not new_password:
            return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(username=username)
            # Check if OTP was verified for this user
            if OTP.objects.filter(user=user, used=True).exists():
                user.set_password(new_password)
                user.save()
                OTP.objects.filter(user=user).delete()  # Clear OTP
                return Response({'message': 'Password reset successful. You can now log in.'})
            return Response({'error': 'OTP not verified. Please verify OTP first.'}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({'error': 'Invalid username'}, status=status.HTTP_400_BAD_REQUEST)

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [AllowAny]   # ← change later if needed
    filter_backends = [SearchFilter]
    search_fields = ['name', 'dept_head_email']


class DesignationViewSet(viewsets.ModelViewSet):
    queryset = Designation.objects.all()
    serializer_class = DesignationSerializer
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'department__name']
    filterset_fields = ['department']


class HiringRequisitionViewSet(viewsets.ModelViewSet):
    queryset = HiringRequisition.objects.all()  # ← removed .order_by('-created_at')
    serializer_class = HiringRequisitionSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        instance = serializer.save()
        send_hiring_email(instance)

def send_hiring_email(requisition):
    try:
        subject = f"New Hiring Requisition: {requisition.ser} - {requisition.requisitioner_name}"
        message = f"""
New Hiring Requisition Submitted!

Serial No: {requisition.ser}
Request Date: {requisition.request_date}
Requisitioner: {requisition.requisitioner_name} ({requisition.requisitioner_email})
Hiring Department: {requisition.hiring_dept} ({requisition.hiring_dept_email})
Designation: {requisition.hiring_designation or requisition.new_designation}
Joining Days: {requisition.select_joining_days}
Planned Joining: {requisition.planned_joined}
Special Instructions: {requisition.special_instructions or 'None'}
Hiring Status: {requisition.hiring_status or 'Not Set'}

CC Emails: {', '.join(requisition.employees_in_cc or [])}

View in admin: https://yourdomain.com/admin/hr/hiringrequisition/
        """
        from_email = settings.DEFAULT_FROM_EMAIL
        recipient_list = ['hr.manager@briskolive.com']  # Change to real HR email
        cc_list = requisition.employees_in_cc or []

        send_mail(
            subject,
            message,
            from_email,
            recipient_list,
            cc=cc_list,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Email sending failed: {e}")