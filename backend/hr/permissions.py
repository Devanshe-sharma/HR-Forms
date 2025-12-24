from rest_framework.permissions import BasePermission

class IsInGroup(BasePermission):
    """
    Allows access only to users in specific groups.
    Usage: permission_classes = [IsInGroup]
    """

    def __init__(self, group_names=None):
        self.group_names = group_names or []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        user_groups = request.user.groups.values_list("name", flat=True)
        return any(group in self.group_names for group in user_groups)
