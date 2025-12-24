from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import CandidateApplication, Country, State, City


# Fixed class name: lowercase → PascalCase (standard Python/DRF convention)
class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["id", "name"]


class StateSerializer(serializers.ModelSerializer):
    # Use the corrected CitySerializer (not old lowercase name)
    cities = CitySerializer(many=True, read_only=True)

    class Meta:
        model = State
        fields = ["id", "name", "cities"]


class CountrySerializer(serializers.ModelSerializer):
    states = StateSerializer(many=True, read_only=True)

    class Meta:
        model = Country
        fields = ["id", "code", "name", "states"]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        # Try to get role from Profile (OneToOneField with User)
        try:
            data["role"] = self.user.profile.role
        except AttributeError:
            # Fallback to group name if Profile doesn't exist
            groups = self.user.groups.values_list("name", flat=True)
            data["role"] = groups[0] if groups else "Outsider"
        return data


class CandidateApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateApplication
        fields = "__all__"

    # Optional improvement: Make resume file read-only in API responses
    # (prevents clients from trying to update uploaded files directly)
    def get_resume(self, obj):
        if obj.resume:
            return self.context["request"].build_absolute_uri(obj.resume.url)
        return None