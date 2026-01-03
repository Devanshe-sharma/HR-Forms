from django.db import migrations

def fix_state_country(apps, schema_editor):
    State = apps.get_model('hr', 'State')
    Country = apps.get_model('hr', 'Country')

    for state in State.objects.all():
        # If country_id is a string (like 'India'), fix it
        if isinstance(state.country_id, str):
            country = Country.objects.filter(name=state.country_id).first()
            if country:
                state.country_id = country.id
                state.save()

class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0010_remove_contractbreakdown_contract_and_more'),  # Adjust to your latest migration
    ]

    operations = [
        migrations.RunPython(fix_state_country),
    ]
