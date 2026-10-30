from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [path('admin/', admin.site.urls), path('api/v1/', include('payments.urls')), path('api/schema/', SpectacularAPIView.as_view()), path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'))]

from safety.views import policy_page, deletion_page, child_safety_standards
urlpatterns += [
    path("api/v1/", include("safety.urls")),
    path("api/v1/safety/child-safety-standards/", child_safety_standards),
    path("api/safety/child-safety-standards/", child_safety_standards),
    path("api/child-safety-standards/", child_safety_standards),
    path("policies/<str:page>/", policy_page),
    path("account-deletion/", deletion_page)
]

urlpatterns += [path('api/v1/', include('account_sessions.urls'))]
