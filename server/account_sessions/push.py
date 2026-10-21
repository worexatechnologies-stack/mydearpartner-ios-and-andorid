from datetime import timedelta
import firebase_admin
from firebase_admin import messaging
from .models import SessionDevice


def send_session_notice(*, user_id, session_id, event_id):
    """Configure Application Default Credentials on the server, never in the app."""
    devices = list(SessionDevice.objects.filter(user_id=user_id, session_id=session_id))
    if not devices:
        raise RuntimeError('Old session has no registered notification target')
    try:
        app = firebase_admin.get_app()
    except ValueError:
        app = firebase_admin.initialize_app(options={'httpTimeout': 5})
    failed = False
    for device in devices:
        try:
            messaging.send(messaging.Message(
                token=device.token,
                notification=messaging.Notification(title='Account security', body=
                    'Your account was signed in on another device. Open the app to check your session.'),
                data={'kind': 'session_replaced', 'session_id': session_id, 'event_id': event_id},
                android=messaging.AndroidConfig(priority='high', ttl=timedelta(hours=1),
                    collapse_key='mdp_session_replaced', notification=messaging.AndroidNotification(
                        channel_id='mdp_messages_v2', tag='mdp_session_replaced')),
                apns=messaging.APNSConfig(headers={'apns-priority': '10', 'apns-collapse-id': 'mdp_session_replaced'},
                    payload=messaging.APNSPayload(aps=messaging.Aps(sound='default', content_available=True))),
            ), app=app)
        except messaging.UnregisteredError:
            device.delete()
        except Exception:
            failed = True
    if failed:
        raise RuntimeError('Session notice delivery needs retry')
