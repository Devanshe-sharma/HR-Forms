from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CandidateApplicationListCreate,
    CandidateApplicationRetrieveUpdate,
    CustomLoginView,
    google_login,
    CountryViewSet,
    StateViewSet,
    CityViewSet,
    EmployeeViewSet,
)

# Router only for ViewSets
router = DefaultRouter()
router.register(r'countries', CountryViewSet, basename='country')
router.register(r'states', StateViewSet, basename='state')
router.register(r'cities', CityViewSet, basename='city')
router.register(r'employees', EmployeeViewSet, basename='employee')
# ← Do NOT register CandidateApplicationListCreate here

urlpatterns = [
    path('', home),
    path('admin/', admin.site.urls),
    path('api/', include('hr.urls')),  # ← Yeh already include kar raha hai router aur manual paths
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]