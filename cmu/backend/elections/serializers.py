from django.contrib.auth import authenticate
from rest_framework import serializers
from .models import Profile, Election, Position, Candidate, Vote


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        try:
            profile = Profile.objects.select_related("user").get(cmu_email__iexact=email)
        except Profile.DoesNotExist:
            raise serializers.ValidationError("Invalid CMU email or password.")

        user = authenticate(username=profile.user.username, password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Invalid CMU email or password.")
        if profile.role != attrs["role"]:
            raise serializers.ValidationError("The selected account type does not match this account.")
        attrs["user"] = user
        return attrs


class CandidateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = ["id", "name", "department", "platform", "gwa", "party_list"]


class PositionSerializer(serializers.ModelSerializer):
    candidates = CandidateSerializer(many=True, read_only=True)

    class Meta:
        model = Position
        fields = ["id", "name", "order", "candidates"]


class ElectionSerializer(serializers.ModelSerializer):
    positions = PositionSerializer(many=True, read_only=True)

    class Meta:
        model = Election
        fields = ["id", "name", "audience", "is_open", "positions"]


class VoteSerializer(serializers.Serializer):
    position_id = serializers.IntegerField()
    candidate_id = serializers.IntegerField()
