import uuid
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ('memberships', '0001_initial')]
    operations = [
        migrations.CreateModel(name='WebhookEvent', fields=[('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ('event_id', models.CharField(max_length=100, unique=True)), ('event_type', models.CharField(max_length=100)), ('payload', models.JSONField()), ('processed_at', models.DateTimeField(blank=True, null=True)), ('failure_reason', models.TextField(blank=True)), ('created_at', models.DateTimeField(auto_now_add=True))]),
        migrations.CreateModel(name='Payment', fields=[('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ('razorpay_order_id', models.CharField(max_length=64, unique=True)), ('razorpay_payment_id', models.CharField(blank=True, max_length=64, null=True, unique=True)), ('amount_paise', models.PositiveIntegerField()), ('currency', models.CharField(default='INR', max_length=3)), ('status', models.CharField(choices=[('created', 'Created'), ('paid', 'Paid'), ('failed', 'Failed')], default='created', max_length=12)), ('activated_at', models.DateTimeField(blank=True, null=True)), ('created_at', models.DateTimeField(auto_now_add=True)), ('plan', models.ForeignKey(on_delete=models.deletion.PROTECT, to='memberships.membershipplan')), ('user', models.ForeignKey(on_delete=models.deletion.PROTECT, to=settings.AUTH_USER_MODEL))]),
    ]
