from django.contrib import admin
from .models import Profile, CandidateApplication, Country, State, City, JobDesignation
from django.utils.html import format_html



@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role')


@admin.register(CandidateApplication)
class CandidateApplicationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'full_name',
        'email',
        'phone',
        'whatsapp_same',
        'dob',
        'state',
        'city',
        'pin_code',
        'relocation',
        'designation',
        'highest_qualification',
        'experience',
        'total_experience',
        'current_ctc',
        'notice_period',
        'expected_monthly_ctc',
        'hindi_read',
        'hindi_write',
        'hindi_speak',
        'english_read',
        'english_write',
        'english_speak',
        'facebookLink',
        'linkedin',
        'short_video_url',
        'resume',
        'created_at',
    )

    search_fields = (
        'full_name',
        'email',
        'phone',
        'designation',
        'city',
        'state',
    )

    list_filter = (
        'designation',
        'experience',
        'relocation',
        'city',
        'state',
        'created_at',
    )

    ordering = ('-created_at',)

    readonly_fields = ('created_at',)

@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name', 'state')
    list_filter = ('state',)
    search_fields = ('name', 'state__name')

@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code')
    search_fields = ('name', 'code')
    ordering = ('name',)

@admin.register(JobDesignation)
class JobDesignationAdmin(admin.ModelAdmin):
    list_display = ('name', 'jd_link_display')
    search_fields = ('name',)
    ordering = ('name',)

    def jd_link_display(self, obj):
        if obj.jd_link:
            return format_html('<a href="{}" target="_blank">View JD</a>', obj.jd_link)
        return "No JD"
    jd_link_display.short_description = "Job Description"