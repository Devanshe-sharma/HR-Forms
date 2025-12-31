from django.urls import path, include
from django.contrib import admin
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# home function optional — production mein nahi chahiye
# def home(request):
#     return HttpResponse("Welcome to HR Forms Backend")

urlpatterns = [
    # path('', home),  # ← Comment out or remove — API app hai, welcome page nahi chahiye
    path('admin/', admin.site.urls),
    path('api/', include('hr.urls')),  # ← Yeh sab API endpoints include karega (countries, employees, candidate-applications, etc.)
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # path('', include(router.urls)),  # ← Yeh line hata do — router hr/urls.py mein hai
]