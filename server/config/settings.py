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
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'rest_framework', 'drf_spectacular', 'memberships', 'payments', 'safety']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.contrib.messages.middleware.MessageMiddleware']
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True, 'OPTIONS': {'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
if os.environ.get('DATABASE_URL'):
    import urllib.parse
    parsed = urllib.parse.urlparse(os.environ['DATABASE_URL'])
    DATABASES['default'] = {'ENGINE': 'django.db.backends.postgresql', 'NAME': parsed.path.lstrip('/'), 'USER': parsed.username, 'PASSWORD': parsed.password, 'HOST': parsed.hostname, 'PORT': parsed.port or 5432}
REST_FRAMEWORK = {'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'], 'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated', 'safety.permissions.AdultMember'], 'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema'}
SPECTACULAR_SETTINGS = {'TITLE': 'My Dear Partner API', 'VERSION': '30.0.0'}
LANGUAGE_CODE, TIME_ZONE, USE_TZ = 'en-us', 'Asia/Kolkata', True
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RAZORPAY_WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
CELERY_BROKER_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
CELERY_BEAT_SCHEDULE = {'expire-memberships-hourly': {'task': 'memberships.tasks.expire_memberships', 'schedule': 3600}}
