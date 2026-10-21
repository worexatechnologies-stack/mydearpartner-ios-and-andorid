from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import AccountSession

REPLACED_MESSAGE = 'Your account was signed in on another device. You have been logged out.'


def require_current_session(user, token):
    sid = token.get('mdp_sid')
    current = AccountSession.objects.filter(user=user).values_list('session_id', flat=True).first()
    if not sid or current is None:
        raise AuthenticationFailed({'code': 'session_expired', 'detail': 'Please sign in again.'})
    if str(current) != str(sid):
        raise AuthenticationFailed({'code': 'session_replaced', 'detail': REPLACED_MESSAGE})


class SingleSessionAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        require_current_session(user, validated_token)
        return user
