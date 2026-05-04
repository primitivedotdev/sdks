from enum import Enum

class EmailStatus(str, Enum):
    ACCEPTED = "accepted"
    COMPLETED = "completed"
    PENDING = "pending"
    REJECTED = "rejected"

    def __str__(self) -> str:
        return str(self.value)
