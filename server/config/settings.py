import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured
from django.core.management.utils import get_random_secret_key

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '').strip()
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = get_random_secret_key()
    else:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be configured when DJANGO_DEBUG is false.')
elif not DEBUG and (len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5 or
                    SECRET_KEY.startswith(('django-insecure-', 'replace-', 'development-'))):
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be a strong, unique production secret.')
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost').split(',')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SSL_REDIRECT', str(not DEBUG)).lower() == 'true'
SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '0' if DEBUG else '3600'))
# Enable only behind a proxy that replaces this header and restricts upstream access.
if os.environ.get('DJANGO_TRUST_PROXY_HTTPS', 'false').lower() == 'true':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'rest_framework', 'drf_spectacular', 'account_sessions', 'memberships', 'payments', 'safety']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.contrib.messages.middleware.MessageMiddleware']
MIDDLEWARE.append('django.middleware.clickjacking.XFrameOptionsMiddleware')
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True, 'OPTIONS': {'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
def _parse_db_url(url_str: str) -> dict:
    import urllib.parse
    parsed = urllib.parse.urlparse(url_str)
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': urllib.parse.unquote(parsed.path.lstrip('/')),
        'USER': urllib.parse.unquote(parsed.username or ''),
        'PASSWORD': urllib.parse.unquote(parsed.password or ''),
        'HOST': parsed.hostname or 'localhost',
        'PORT': parsed.port or 5432,
        'CONN_MAX_AGE': int(os.environ.get('DB_CONN_MAX_AGE', '60')),
        'CONN_HEALTH_CHECKS': True,
        # The supplied Compose stack uses PgBouncer transaction pooling.
        'DISABLE_SERVER_SIDE_CURSORS': True,
    }

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
if os.environ.get('DATABASE_URL'):
    DATABASES['default'] = _parse_db_url(os.environ['DATABASE_URL'])

# Read replica load balancer configuration:
# Accepts single replica via DATABASE_READ_REPLICA_URL or multiple via DATABASE_REPLICAS_URLS (comma-separated)
_replica_urls = []
if os.environ.get('DATABASE_READ_REPLICA_URL'):
    _replica_urls.append(os.environ['DATABASE_READ_REPLICA_URL'])
if os.environ.get('DATABASE_REPLICAS_URLS'):
    for _u in os.environ['DATABASE_REPLICAS_URLS'].split(','):
        _u = _u.strip()
        if _u and _u not in _replica_urls:
            _replica_urls.append(_u)

for _idx, _rep_url in enumerate(_replica_urls):
    _alias = 'replica' if _idx == 0 else f'replica_{_idx + 1}'
    DATABASES[_alias] = _parse_db_url(_rep_url)

DATABASE_ROUTERS = ['config.db_router.DatabaseLoadBalancerRouter']
DB_LOAD_BALANCER_STRATEGY = os.environ.get('DB_LOAD_BALANCER_STRATEGY', 'round_robin')
REST_FRAMEWORK = {'DEFAULT_AUTHENTICATION_CLASSES': ['account_sessions.authentication.SingleSessionAuthentication'], 'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated', 'safety.permissions.AdultMember'], 'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema'}
SPECTACULAR_SETTINGS = {'TITLE': 'My Dear Partner API', 'VERSION': '30.0.0'}
LANGUAGE_CODE, TIME_ZONE, USE_TZ = 'en-us', 'Asia/Kolkata', True
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RAZORPAY_WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
CELERY_BROKER_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
CELERY_BEAT_SCHEDULE = {'expire-memberships-hourly': {'task': 'memberships.tasks.expire_memberships', 'schedule': 3600}}

SESSION_REPLACED_NOTIFY = os.environ.get('SESSION_REPLACED_NOTIFY', 'account_sessions.push.send_session_notice')
