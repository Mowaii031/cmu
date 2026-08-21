from django.contrib.auth.models import User
from django.db import models


class Profile(models.Model):
    ROLE_CHOICES = [("student", "Student"), ("alumni", "Alumni"), ("faculty", "Faculty")]
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    cmu_email = models.EmailField(unique=True)

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class Election(models.Model):
    name = models.CharField(max_length=120)
    audience = models.CharField(max_length=20, choices=Profile.ROLE_CHOICES)
    is_open = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Position(models.Model):
    election = models.ForeignKey(Election, on_delete=models.CASCADE, related_name="positions")
    name = models.CharField(max_length=80)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]


class Candidate(models.Model):
    position = models.ForeignKey(Position, on_delete=models.CASCADE, related_name="candidates")
    name = models.CharField(max_length=120)
    department = models.CharField(max_length=120, blank=True)
    platform = models.TextField(blank=True)
    gwa = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    party_list = models.CharField(max_length=120, blank=True)
    photo = models.ImageField(upload_to="candidates/", null=True, blank=True)


class Vote(models.Model):
    voter = models.ForeignKey(User, on_delete=models.CASCADE, related_name="votes")
    election = models.ForeignKey(Election, on_delete=models.CASCADE)
    position = models.ForeignKey(Position, on_delete=models.CASCADE)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["voter", "election", "position"],
                name="one_vote_per_voter_position",
            )
        ]


class PasswordResetRequest(models.Model):
    """Short-lived password-reset challenge used by the React reset flow."""

    email = models.EmailField(db_index=True)
    code_hash = models.CharField(max_length=64)
    reset_token_hash = models.CharField(max_length=64, blank=True)
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Password reset for {self.email}"
