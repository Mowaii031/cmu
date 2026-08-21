import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Profile, Election, Position, Candidate, Vote, PasswordResetRequest
from .serializers import LoginSerializer, ElectionSerializer, VoteSerializer


def hash_value(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_reset_code():
    return f"{secrets.randbelow(1_000_000):06d}"


def send_reset_code(email, code):
    send_mail(
        subject="CMU-ELECT password reset verification code",
        message=(
            "Your CMU-ELECT verification code is " + code +
            ". It expires in 10 minutes. If you did not request a password reset, "
            "you can ignore this message."
        ),
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "cmu-elect@localhost"),
        recipient_list=[email],
        fail_silently=False,
    )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.profile.role,
                "email": user.profile.cmu_email,
            },
        })


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({"detail": "Logged out."})


class MeView(APIView):
    def get(self, request):
        return Response({
            "id": request.user.id,
            "username": request.user.username,
            "role": request.user.profile.role,
            "email": request.user.profile.cmu_email,
        })


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return Response({"detail": "Please enter your CMU email."}, status=400)

        # Use a generic success message so the API does not reveal whether an account exists.
        response = {"detail": "If that CMU email exists, a verification code has been sent."}
        try:
            profile = Profile.objects.select_related("user").get(cmu_email__iexact=email)
        except Profile.DoesNotExist:
            return Response(response)

        PasswordResetRequest.objects.filter(
            email__iexact=email, used_at__isnull=True
        ).update(used_at=timezone.now())

        code = create_reset_code()
        PasswordResetRequest.objects.create(
            email=profile.cmu_email,
            code_hash=hash_value(code),
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        send_reset_code(profile.cmu_email, code)


        if settings.DEBUG:
            response["dev_code"] = code
        return Response(response)


class VerifyResetCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        code = str(request.data.get("code", "")).strip()
        if not email or not code:
            return Response({"detail": "Email and verification code are required."}, status=400)

        reset = PasswordResetRequest.objects.filter(
            email__iexact=email,
            used_at__isnull=True,
            verified_at__isnull=True,
        ).order_by("-created_at").first()
        if not reset or reset.expires_at < timezone.now():
            return Response({"detail": "That code has expired. Please request a new one."}, status=400)
        if reset.attempts >= 5:
            return Response({"detail": "Too many attempts. Please request a new code."}, status=400)

        if hash_value(code) != reset.code_hash:
            reset.attempts += 1
            reset.save(update_fields=["attempts"])
            return Response({"detail": "Invalid verification code."}, status=400)

        token = secrets.token_urlsafe(32)
        reset.verified_at = timezone.now()
        reset.reset_token_hash = hash_value(token)
        reset.save(update_fields=["verified_at", "reset_token_hash"])
        return Response({"detail": "Code verified.", "reset_token": token})


class ResendResetCodeView(ForgotPasswordView):
    pass


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        reset_token = str(request.data.get("reset_token", "")).strip()
        password = str(request.data.get("password", ""))
        confirm_password = str(request.data.get("confirm_password", ""))

        if not all([email, reset_token, password, confirm_password]):
            return Response({"detail": "All fields are required."}, status=400)
        if password != confirm_password:
            return Response({"detail": "Passwords do not match."}, status=400)
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=400)

        reset = PasswordResetRequest.objects.filter(
            email__iexact=email,
            verified_at__isnull=False,
            used_at__isnull=True,
        ).order_by("-created_at").first()
        if not reset or reset.expires_at < timezone.now():
            return Response({"detail": "Your reset session has expired. Please start again."}, status=400)
        if hash_value(reset_token) != reset.reset_token_hash:
            return Response({"detail": "Invalid reset session."}, status=400)

        try:
            profile = Profile.objects.select_related("user").get(cmu_email__iexact=email)
        except Profile.DoesNotExist:
            return Response({"detail": "Account not found."}, status=400)

        user = profile.user
        user.set_password(password)
        user.save(update_fields=["password"])
        Token.objects.filter(user=user).delete()
        reset.used_at = timezone.now()
        reset.save(update_fields=["used_at"])
        return Response({"detail": "Password changed successfully."})


class ElectionListView(APIView):
    def get(self, request):
        role = request.user.profile.role
        elections = Election.objects.filter(audience=role)
        return Response(ElectionSerializer(elections, many=True).data)


class VoteView(APIView):
    @transaction.atomic
    def post(self, request):
        data = VoteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        position = Position.objects.select_related("election").get(id=data.validated_data["position_id"])
        candidate = Candidate.objects.get(id=data.validated_data["candidate_id"], position=position)
        election = position.election
        if not election.is_open:
            return Response({"detail": "This election is closed."}, status=400)
        if election.audience != request.user.profile.role:
            return Response({"detail": "You are not eligible for this election."}, status=403)
        if Vote.objects.filter(voter=request.user, election=election, position=position).exists():
            return Response({"detail": "You already voted for this position."}, status=400)
        Vote.objects.create(
            voter=request.user, election=election, position=position, candidate=candidate
        )
        return Response({"detail": "Vote recorded."}, status=status.HTTP_201_CREATED)


class ResultsView(APIView):
    def get(self, request, election_id):
        election = Election.objects.get(id=election_id)
        results = []
        for position in election.positions.all():
            rows = []
            for candidate in position.candidates.all():
                rows.append({
                    "candidate": candidate.name,
                    "votes": Vote.objects.filter(
                        election=election, position=position, candidate=candidate
                    ).count(),
                })
            results.append({"position": position.name, "candidates": rows})
        return Response({"election": election.name, "results": results})
