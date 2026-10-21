from django.urls import path
from .views import LoginView, SessionRefreshView, SessionStatusView, SessionLogoutView, SessionDeviceView

urlpatterns = [path('auth/session/device/', SessionDeviceView.as_view()),
               path('auth/login/', LoginView.as_view()),
               path('auth/token/refresh/', SessionRefreshView.as_view()),
               path('auth/session/', SessionStatusView.as_view()),
               path('auth/logout/', SessionLogoutView.as_view())]
