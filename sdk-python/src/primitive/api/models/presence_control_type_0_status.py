from enum import Enum

class PresenceControlType0Status(str, Enum):
    PENDING = "pending"
    REJECTED = "rejected"
    VERIFIED = "verified"

    def __str__(self) -> str:
        return str(self.value)
