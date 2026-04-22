from enum import Enum

class SendResultStatus(str, Enum):
    ACCEPTED = "accepted"
    FAILED = "failed"
    REJECTED = "rejected"
    TEMPFAILED = "tempfailed"

    def __str__(self) -> str:
        return str(self.value)
