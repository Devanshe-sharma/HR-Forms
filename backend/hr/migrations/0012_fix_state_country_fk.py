from django.db import migrations

def fix_country_fk(apps, schema_editor):
    Country = apps.get_model('hr', 'Country')

    india = Country.objects.get(name='India')

    # RAW SQL because ORM cannot touch invalid FK data
    schema_editor.execute(
        """
        UPDATE hr_state
        SET country_id = %s
        WHERE country_id = 'India'
        """,
        [india.id],
    )

class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0011_auto_20260102_1724'),
    ]

    operations = [
        migrations.RunPython(fix_country_fk),
    ]
