from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from django.http import JsonResponse

urlpatterns = [
    path('', lambda r: JsonResponse({"status": "API running 🚀"})),
    path('admin/', admin.site.urls),
    path('api/', include('hr.urls')),
    path('api/token/', TokenObtainPairView.as_view()),
    path('api/token/refresh/', TokenRefreshView.as_view()),
]
