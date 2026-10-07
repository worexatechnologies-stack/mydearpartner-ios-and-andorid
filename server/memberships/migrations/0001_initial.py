import uuid
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name='MembershipPlan', fields=[('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ('slug', models.SlugField(unique=True)), ('name', models.CharField(max_length=100)), ('price_paise', models.PositiveIntegerField()), ('duration_days', models.PositiveIntegerField()), ('is_active', models.BooleanField(default=True)), ('feature_limits', models.JSONField(default=dict))]),
        migrations.CreateModel(name='Membership', fields=[('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ('status', models.CharField(choices=[('active', 'Active'), ('expired', 'Expired'), ('cancelled', 'Cancelled'), ('grace', 'Grace')], default='expired', max_length=12)), ('starts_at', models.DateTimeField(blank=True, null=True)), ('ends_at', models.DateTimeField(blank=True, null=True)), ('plan', models.ForeignKey(on_delete=models.deletion.PROTECT, to='memberships.membershipplan')), ('user', models.OneToOneField(on_delete=models.deletion.CASCADE, to=settings.AUTH_USER_MODEL))]),
    ]
