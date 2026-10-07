from django.urls import path
from . import views
urlpatterns = [path('payments/orders/', views.create_order), path('payments/verify/', views.verify_payment), path('payments/webhooks/razorpay/', views.razorpay_webhook), path('member/membership/', views.my_membership)]
