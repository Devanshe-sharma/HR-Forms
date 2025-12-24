from django.db import models
from django.contrib.auth.models import User




class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(
        max_length=20,
        choices=[
            ("HR", "HR+Management"),
            ("Admin", "Admin/Tech"),
            ("Employee", "Company People"),
            ("Outsider", "Outsider"),
        ]
    )

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class Country(models.Model):
    code = models.CharField(max_length=5)  # ← Removed unique=True
    name = models.CharField(max_length=100, unique=True)  # ← Make name unique instead

    class Meta:
        verbose_name_plural = "Countries"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} (+{self.code})"


class State(models.Model):
    name = models.CharField(max_length=100)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="states", null=True, blank=True)  # ← Add null=True, blank=True

    def __str__(self):
        return f"{self.name}, {self.country.name if self.country else 'No Country'}"



class City(models.Model):
    name = models.CharField(max_length=100)
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="cities")

    def __str__(self):
        return f"{self.name}, {self.state.name}"


from django.db import models

class CandidateApplication(models.Model):
    full_name = models.CharField(max_length=100)
    email = models.EmailField()

    phone = models.CharField(max_length=20)
    whatsapp_same = models.BooleanField(default=False, blank=True)

    dob = models.CharField(max_length=20)

    state = models.CharField(max_length=50)
    city = models.CharField(max_length=100, blank=True, null=True)
    
    pin_code = models.CharField(max_length=6)

    relocation = models.CharField(max_length=3)  # Yes / No
    designation = models.CharField(max_length=100, blank=True, null=True)

    highest_qualification = models.TextField()

    experience = models.CharField(max_length=3)  # Yes / No
    total_experience = models.CharField(max_length=10, blank=True, null=True)
    current_ctc = models.CharField(max_length=20, blank=True, null=True)
    notice_period = models.CharField(max_length=10, blank=True, null=True)

    expected_monthly_ctc = models.CharField(max_length=20)

    hindi_read = models.CharField(max_length=20)
    hindi_write = models.CharField(max_length=20)
    hindi_speak = models.CharField(max_length=20)

    english_read = models.CharField(max_length=20)
    english_write = models.CharField(max_length=20)
    english_speak = models.CharField(max_length=20)

    facebookLink = models.URLField(blank=True, null=True)
    linkedin = models.URLField(blank=True, null=True)
    short_video_url = models.URLField(blank=True, null=True)

    resume = models.FileField(upload_to="resumes/", blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class JobDesignation(models.Model):
    name = models.CharField(max_length=100, unique=True)
    jd_link = models.URLField(max_length=500, blank=True, null=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Job Designations"
        ordering = ['name']