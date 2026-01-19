from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import CandidateApplication, Country, Department, Designation, State, City, Employee, CTCComponent, Contract, Payslip

class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = '__all__'

class PayslipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payslip
        fields = '__all__'

class EmployeeSerializer(serializers.ModelSerializer):
    contracts = ContractSerializer(many=True, read_only=True)
    payslips = PayslipSerializer(many=True, read_only=True)

    class Meta:
        model = Employee
        fields = '__all__'
        extra_kwargs = {
            # Auto-calculated fields read-only
            'gross_monthly': {'read_only': True},
            'monthly_ctc': {'read_only': True},
            'gratuity': {'read_only': True},
            'annual_ctc': {'read_only': True},
            'equivalent_monthly_ctc': {'read_only': True},
            # Make these writable & nullable
            'contract_amount': {'required': False, 'allow_null': True},
            'contract_period_months': {'required': False, 'allow_null': True},
            'sal_applicable_from': {'required': False, 'allow_null': True},
        }


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

class CTCComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CTCComponent
        fields = "__all__"

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
    # This creates a read-only field for the React table
    location = serializers.SerializerMethodField()



    def get_location(self, obj):
        parts = []
        if obj.city:
            parts.append(obj.city.name)
        if obj.state:
            parts.append(obj.state.name)
        return " • ".join(parts) if parts else "—"

class DepartmentSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True, allow_null=True)
    hierarchy = serializers.CharField(source='get_hierarchy', read_only=True)

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'dept_page_link', 'dept_head_email', 'dept_group_email',
            'parent', 'parent_name', 'department_type', 'hierarchy',
            'created_at', 'updated_at'
        ]


class DesignationSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = Designation
        fields = [
            'id', 'department', 'department_name', 'name',
            'role_document_link', 'jd_link', 'remarks', 'role_document_text',
            'created_at', 'updated_at'
        ]