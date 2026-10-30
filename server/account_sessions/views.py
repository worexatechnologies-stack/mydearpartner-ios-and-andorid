import re
from django.contrib.auth import authenticate, get_user_model
from django.db import models, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException, AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from .authentication import SingleSessionAuthentication, require_current_session
from .models import AccountSession, OtpChallenge, SessionDevice
from .services import create_otp_challenge, issue_session_tokens, resolve_user_phone, verify_challenge_otp
from .sms import SmsDeliveryError, mask_phone, send_sms_otp
from drf_spectacular.utils import extend_schema, inline_serializer


class LoginThrottle(AnonRateThrottle):
    rate = '10/min'


class LoginInput(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class LoginView(APIView):
    """Validate ID and password, then challenge the registered mobile number."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginThrottle]

    def get_authenticate_header(self, request):
        return 'Bearer'

    @extend_schema(request=LoginInput, responses=inline_serializer('SessionLoginResponse', fields={
        'requires_otp': serializers.BooleanField(), 'challenge_id': serializers.UUIDField(),
        'phone_masked': serializers.CharField(),
    }))
    def post(self, request):
        serializer = LoginInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data['identifier'].strip()
        password = serializer.validated_data['password']
        UserModel = get_user_model()
        user = authenticate(request=request, **{UserModel.USERNAME_FIELD: identifier, 'password': password})
        if not user:
            candidates = UserModel.objects.filter(email__iexact=identifier) if '@' in identifier else UserModel.objects.none()
            if re.fullmatch(r'(?:\+?91[ -]?)?[6-9][0-9]{9}', identifier):
                digits = re.sub(r'\D', '', identifier)[-10:]
                candidates = UserModel.objects.filter(models.Q(phone_record__phone_number__in=[digits, '+91' + digits, '91' + digits], phone_record__is_verified=True))
            candidate = candidates.first()
            if candidate:
                user = authenticate(request=request, **{
                    UserModel.USERNAME_FIELD: getattr(candidate, UserModel.USERNAME_FIELD),
                    'password': password,
                })
        if not user or not user.is_active:
            raise AuthenticationFailed('Incorrect credentials.')
        phone = resolve_user_phone(user)
        if not phone:
            raise ValidationError('A verified mobile number is required. Please contact support to update your account.')
        challenge = deliver_login_challenge(user, phone, request)
        return Response(challenge_response(challenge))


class OtpDeliveryUnavailable(APIException):
    status_code = 503
    default_detail = 'Could not send your verification code. Please try again later.'


def challenge_response(challenge):
    return {
        'requires_otp': True,
        'challenge_id': str(challenge.pk),
        'phone_masked': mask_phone(challenge.phone_number),
        'message': 'Verification code sent to your registered mobile number.',
    }


def deliver_login_challenge(user, phone, request, previous_id=None):
    # Serialize login/resend/verification for this user, including the first challenge.
    try:
        with transaction.atomic():
            user = get_user_model().objects.select_for_update().get(pk=user.pk)
            if not user.is_active:
                raise AuthenticationFailed('Please sign in again.')
            if resolve_user_phone(user) != phone:
                raise AuthenticationFailed('Registered mobile changed. Please sign in again.')
            now = timezone.now()
            if previous_id:
                previous = OtpChallenge.objects.filter(pk=previous_id, user=user).first()
                if not previous or previous.is_consumed or previous.is_superseded or previous.expires_at <= now:
                    raise AuthenticationFailed('Verification session expired. Please sign in again.')
            latest = OtpChallenge.objects.filter(user=user).order_by('-created_at').first()
            if latest and latest.resend_available_at > now:
                raise ValidationError('Please wait 60 seconds before requesting another code.')
            OtpChallenge.objects.filter(user=user, is_consumed=False, is_superseded=False).update(is_superseded=True)
            challenge, otp = create_otp_challenge(user, phone, ip_address=request.META.get('REMOTE_ADDR'))
            if not send_sms_otp(phone, otp, user=user):
                raise SmsDeliveryError('SMS delivery failed.')
            return challenge
    except SmsDeliveryError:
        # Roll back the replacement so a provider outage does not discard a valid code.
        raise OtpDeliveryUnavailable() from None


class LoginOtpInput(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    otp = serializers.RegexField(r'^\d{6}$', min_length=6, max_length=6)


class LoginOtpVerifyView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginThrottle]

    def get_authenticate_header(self, request):
        return 'Bearer'

    def post(self, request):
        serializer = LoginOtpInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        challenge_id = serializer.validated_data['challenge_id']
        candidate = OtpChallenge.objects.filter(pk=challenge_id).first()
        if not candidate:
            raise AuthenticationFailed('Verification session expired. Please sign in again.')
        error = None
        with transaction.atomic():
            user = get_user_model().objects.select_for_update().get(pk=candidate.user_id)
            challenge = OtpChallenge.objects.select_for_update().get(pk=challenge_id)
            if (not user.is_active or challenge.is_consumed or challenge.is_superseded
                    or challenge.expires_at <= timezone.now()
                    or resolve_user_phone(user) != challenge.phone_number):
                error = 'Verification session expired. Please sign in again.'
            elif challenge.attempts >= challenge.max_attempts:
                error = 'Too many incorrect attempts. Please request a new code.'
            elif not verify_challenge_otp(challenge, serializer.validated_data['otp']):
                challenge.attempts += 1
                challenge.save(update_fields=['attempts'])
                error = 'Incorrect verification code. Please try again.'
            else:
                challenge.is_consumed = True
                challenge.save(update_fields=['is_consumed'])
                tokens = issue_session_tokens(user)
        # Raise after committing failed attempts so the counter cannot be rolled back.
        if error:
            raise AuthenticationFailed(error)
        return Response({**tokens, 'user': {'id': str(user.pk)}})


class LoginOtpResendInput(serializers.Serializer):
    challenge_id = serializers.UUIDField()


class LoginOtpResendView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginThrottle]

    def get_authenticate_header(self, request):
        return 'Bearer'

    def post(self, request):
        serializer = LoginOtpResendInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        challenge = OtpChallenge.objects.filter(pk=serializer.validated_data['challenge_id']).select_related('user').first()
        if not challenge:
            raise AuthenticationFailed('Verification session expired. Please sign in again.')
        replacement = deliver_login_challenge(challenge.user, challenge.phone_number, request, previous_id=challenge.pk)
        return Response(challenge_response(replacement))


class SingleSessionRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        token = RefreshToken(attrs['refresh'])
        with transaction.atomic():
            try:
                user = get_user_model().objects.select_for_update().get(**{
                    api_settings.USER_ID_FIELD: token[api_settings.USER_ID_CLAIM]})
            except (get_user_model().DoesNotExist, KeyError):
                raise AuthenticationFailed('Please sign in again.')
            if not user.is_active:
                raise AuthenticationFailed('Please sign in again.')
            require_current_session(user, token)
            return super().validate(attrs)


class SessionRefreshView(TokenRefreshView):
    serializer_class = SingleSessionRefreshSerializer


class SessionStatusView(APIView):
    authentication_classes = [SingleSessionAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=inline_serializer('SessionStatusResponse', fields={'active': serializers.BooleanField()}))
    def get(self, request):
        response = Response({'active': True})
        response['Cache-Control'] = 'no-store'
        return response


class SessionLogoutView(SessionStatusView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        # Old/in-flight logout must never remove a later login's session.
        AccountSession.objects.filter(user=request.user, session_id=request.auth['mdp_sid']).delete()
        return Response(status=204)


class SessionDeviceInput(serializers.Serializer):
    token = serializers.CharField(max_length=4096, min_length=10, trim_whitespace=True)


class SessionDeviceView(SessionStatusView):
    @extend_schema(request=SessionDeviceInput, responses={204: None})
    def post(self, request):
        serializer = SessionDeviceInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            get_user_model().objects.select_for_update().get(pk=request.user.pk)
            require_current_session(request.user, request.auth)
            SessionDevice.objects.update_or_create(token=serializer.validated_data['token'], defaults={
                'user': request.user, 'session_id': request.auth['mdp_sid']})
        return Response(status=204)
