from django.urls import path
from .views import (
    LoginView, LogoutView, MeView, ForgotPasswordView,
    VerifyResetCodeView, ResetPasswordView, ResendResetCodeView,
    ElectionListView, VoteView, ResultsView,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view()),
    path("auth/logout/", LogoutView.as_view()),
    path("auth/me/", MeView.as_view()),
    path("auth/forgot-password/", ForgotPasswordView.as_view()),
    path("auth/resend-code/", ResendResetCodeView.as_view()),
    path("auth/verify-code/", VerifyResetCodeView.as_view()),
    path("auth/reset-password/", ResetPasswordView.as_view()),
    path("elections/", ElectionListView.as_view()),
    path("votes/", VoteView.as_view()),
    path("elections/<int:election_id>/results/", ResultsView.as_view()),
]
