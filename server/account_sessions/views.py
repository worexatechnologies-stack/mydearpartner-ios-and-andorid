from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from .authentication import SingleSessionAuthentication, require_current_session
from .models import AccountSession, SessionDevice
from .services import issue_session_tokens


class LoginThrottle(AnonRateThrottle):
    rate = '10/min'


class LoginInput(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class LoginView(APIView):
    """Local reference adapter; production keeps its existing credential validation."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginThrottle]

    def get_authenticate_header(self, request):
        return 'Bearer'

    def post(self, request):
        serializer = LoginInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request=request, **{
            get_user_model().USERNAME_FIELD: serializer.validated_data['identifier'],
            'password': serializer.validated_data['password'],
        })
        if not user or not user.is_active:
            raise AuthenticationFailed('Incorrect credentials.')
        return Response({**issue_session_tokens(user), 'user': {'id': str(user.pk)}})


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

    def get(self, request):
        response = Response({'active': True})
        response['Cache-Control'] = 'no-store'
        return response


class SessionLogoutView(SessionStatusView):
    def post(self, request):
        # Old/in-flight logout must never remove a later login's session.
        AccountSession.objects.filter(user=request.user, session_id=request.auth['mdp_sid']).delete()
        return Response(status=204)


class SessionDeviceInput(serializers.Serializer):
    token = serializers.CharField(max_length=4096, min_length=10, trim_whitespace=True)


class SessionDeviceView(SessionStatusView):
    def post(self, request):
        serializer = SessionDeviceInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            get_user_model().objects.select_for_update().get(pk=request.user.pk)
            require_current_session(request.user, request.auth)
            SessionDevice.objects.update_or_create(token=serializer.validated_data['token'], defaults={
                'user': request.user, 'session_id': request.auth['mdp_sid']})
        return Response(status=204)
