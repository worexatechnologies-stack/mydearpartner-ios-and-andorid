from django.urls import path
from . import views

urlpatterns = [
    path('safety/eligibility/', views.eligibility),
    path('safety/reports/', views.report),
    path('safety/account-deletion/', views.account_deletion),
    path('safety/child-safety-standards/', views.child_safety_standards, name='child_safety_standards'),
    path('safety/child-safety/', views.child_safety_standards),
    path('child-safety-standards/', views.child_safety_standards),
    path('child-safety/', views.child_safety_standards),
]
