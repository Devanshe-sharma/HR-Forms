from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CandidateApplicationListCreate,
    CandidateApplicationRetrieveUpdate,
    CustomLoginView,
    CountryViewSet,
    StateViewSet,
    CityViewSet,
    EmployeeViewSet,
    forgot_password,
    OTPVerifyView,
    reset_password,
    users_exist,
    setup_user,
)

router = DefaultRouter()
router.register(r'countries', CountryViewSet, basename='country')
router.register(r'states', StateViewSet, basename='state')
router.register(r'cities', CityViewSet, basename='city')
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'ctc-components', CTCComponentViewSet)

urlpatterns = [
    # Router URLs (countries, states, cities, employees)
    path('', include(router.urls)),

    # Manual API endpoints
    path('candidate-applications/', CandidateApplicationListCreate.as_view()),
    path('candidate-applications/<int:pk>/', CandidateApplicationRetrieveUpdate.as_view()),

    path('login/', CustomLoginView.as_view()),
   

    # Auth endpoints
    path('auth/forgot-password/', forgot_password),
    path('auth/otp-verify/', OTPVerifyView.as_view()),
    path('auth/reset-password/', reset_password),
    path('auth/users-exist/', users_exist),
    path('auth/setup-user/', setup_user),
]