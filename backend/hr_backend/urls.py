# hr_backend/urls.py (main project urls)

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenRefreshView
from django.http import HttpResponse
from hr.views import (
    CustomLoginView,
    forgot_password,
    OTPVerifyView,
    reset_password,
    users_exist,
    setup_user,
)
def health(request):
    return HttpResponse("ok")



urlpatterns = [
    # Root API status check
    path('', lambda request: JsonResponse({"status": "API running "})),
    path("health", health),

    # Django Admin
    path('admin/', admin.site.urls),

    # All HR app API routes (employees, countries, etc.)
    path('api/', include('hr.urls')),

    # JWT Authentication
    path('api/token/', CustomLoginView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # OTP-based Password Reset & First-time Setup
    path('api/auth/forgot-password/', forgot_password, name='forgot_password'),
    path('api/auth/otp-verify/', OTPVerifyView.as_view(), name='otp_verify'),
    path('api/auth/reset-password/', reset_password, name='reset_password'),
    path('api/auth/users-exist/', users_exist, name='users_exist'),
    path('api/auth/setup-user/', setup_user, name='setup_user'),
]