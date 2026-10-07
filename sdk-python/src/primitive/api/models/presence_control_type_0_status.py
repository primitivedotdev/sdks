from enum import StrEnum

class PresenceControlType0Status(StrEnum):
    PENDING = "pending"
    REJECTED = "rejected"
    VERIFIED = "verified"

    def __str__(self) -> str:
        return str(self.value)
