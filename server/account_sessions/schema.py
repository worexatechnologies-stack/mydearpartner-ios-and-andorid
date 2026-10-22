from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme


class SingleSessionScheme(SimpleJWTScheme):
    target_class = 'account_sessions.authentication.SingleSessionAuthentication'
    name = 'sessionJwtAuth'
    priority = 1
