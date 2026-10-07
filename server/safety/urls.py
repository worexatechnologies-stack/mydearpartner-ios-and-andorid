from django.urls import path
from . import views

urlpatterns = [
    path('safety/eligibility/', views.eligibility),
    path('safety/reports/', views.report),
    path('safety/account-deletion/', views.account_deletion),
]
