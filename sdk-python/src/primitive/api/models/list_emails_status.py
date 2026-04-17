from enum import Enum

class ListEmailsStatus(str, Enum):
    ACCEPTED = "accepted"
    COMPLETED = "completed"
    PENDING = "pending"
    REJECTED = "rejected"

    def __str__(self) -> str:
        return str(self.value)
