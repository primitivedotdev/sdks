from enum import StrEnum

class X402ChallengeStatus(StrEnum):
    EXPIRED = "expired"
    FAILED = "failed"
    PENDING = "pending"
    SETTLED = "settled"
    SETTLING = "settling"

    def __str__(self) -> str:
        return str(self.value)
