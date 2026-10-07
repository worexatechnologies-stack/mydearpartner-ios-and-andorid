from rest_framework import serializers
from .permissions import is_adult
from .policies import POLICY_VERSION

REASONS = [
    'Underage user', 'Child exploitation or abuse', 'Non-consensual intimate content',
    'Deepfake or impersonation', 'Harassment or threats', 'Scam or fraud',
    'Sexual or other prohibited content', 'Other safety concern',
]


class EligibilitySerializer(serializers.Serializer):
    date_of_birth = serializers.DateField()
    policy_version = serializers.CharField(max_length=32)
    accepted = serializers.BooleanField()

    def validate_date_of_birth(self, value):
        if not is_adult(value):
            raise serializers.ValidationError('You must be at least 18 years old.')
        return value

    def validate_policy_version(self, value):
        if value != POLICY_VERSION:
            raise serializers.ValidationError('Read and accept the current policies.')
        return value

    def validate_accepted(self, value):
        if not value:
            raise serializers.ValidationError('Acceptance is required.')
        return value


class ReportSerializer(serializers.Serializer):
    profile_id = serializers.CharField(max_length=128)
    chat_id = serializers.CharField(max_length=128, required=False, allow_blank=True)
    message_id = serializers.CharField(max_length=128, required=False, allow_blank=True)
    reason = serializers.ChoiceField(choices=REASONS)
    details = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    def validate(self, data):
        if data.get('message_id') and not data.get('chat_id'):
            raise serializers.ValidationError('A message report must identify its conversation.')
        return data


class DeletionSerializer(serializers.Serializer):
    confirm = serializers.BooleanField()

    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError('Confirm that you want account deletion.')
        return value
