from django import forms
from django.contrib import admin
from .models import Eligibility, SafetyRequest


class RequestForm(forms.ModelForm):
    class Meta:
        model = SafetyRequest
        fields = '__all__'

    def clean(self):
        data = super().clean()
        if data.get('status') == 'completed':
            if not data.get('resolution', '').strip():
                raise forms.ValidationError('Record the action taken, retained data and user notification before completing a request.')
            if self.instance.kind == 'deletion' and not data.get('ownership_verified'):
                raise forms.ValidationError('Verify account ownership before completing deletion.')
        return data


@admin.register(SafetyRequest)
class RequestAdmin(admin.ModelAdmin):
    form = RequestForm
    list_display = ['id', 'kind', 'urgent', 'status', 'created_at', 'updated_at']
    list_filter = ['kind', 'status', 'urgent']
    search_fields = ['id', 'email', 'profile_id']
    readonly_fields = ['id', 'kind', 'user', 'email', 'profile_id', 'chat_id', 'message_id', 'reason', 'details', 'created_at', 'updated_at']

    def has_add_permission(self, request):
        return False


@admin.register(Eligibility)
class EligibilityAdmin(admin.ModelAdmin):
    list_display = ['user', 'policy_version', 'accepted_at']
    readonly_fields = ['user', 'date_of_birth', 'policy_version', 'accepted_at']

    def has_add_permission(self, request):
        return False
