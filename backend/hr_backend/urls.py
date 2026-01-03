from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from django.http import JsonResponse
from hr.views import (
    forgot_password,
    reset_password,
    users_exist,
    setup_user,
    CustomLoginView,
)

urlpatterns = [
    path('', lambda r: JsonResponse({"status": "API running 🚀"})),
    path('admin/', admin.site.urls),

    # Main HR app API routes
    path('api/', include('hr.urls')),

    # JWT token routes (optional if you use CustomLoginView)
    path('api/token/', CustomLoginView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Password reset and user setup endpoints
    path('api/auth/forgot-password/', forgot_password, name='forgot_password'),
    path('api/auth/reset-password/', reset_password, name='reset_password'),
    path('api/auth/users-exist/', users_exist, name='users_exist'),
    path('api/auth/setup-user/', setup_user, name='setup_user'),
]
