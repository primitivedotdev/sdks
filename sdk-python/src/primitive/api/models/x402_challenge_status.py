from enum import Enum

class X402ChallengeStatus(str, Enum):
    EXPIRED = "expired"
    FAILED = "failed"
    PENDING = "pending"
    SETTLED = "settled"
    SETTLING = "settling"

    def __str__(self) -> str:
        return str(self.value)
