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
)

# Router only for ViewSets
router = DefaultRouter()
router.register(r'countries', CountryViewSet, basename='country')
router.register(r'states', StateViewSet, basename='state')
router.register(r'cities', CityViewSet, basename='city')
# ← Do NOT register CandidateApplicationListCreate here

urlpatterns = [
    # Include router URLs (for countries, states, cities)
    path('', include(router.urls)),

    # Manual paths for non-ViewSet views
    path('candidate-applications/', CandidateApplicationListCreate.as_view(), name='candidate-application-list'),
    path('candidate-applications/<int:pk>/', CandidateApplicationRetrieveUpdate.as_view(), name='candidate-application-detail'),

    path('login/', CustomLoginView.as_view(), name='custom_login'),
    path('google-login/', google_login, name='google_login'),
]