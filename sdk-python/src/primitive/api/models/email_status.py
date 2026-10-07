from enum import StrEnum

class EmailStatus(StrEnum):
    ACCEPTED = "accepted"
    COMPLETED = "completed"
    PENDING = "pending"
    REJECTED = "rejected"

    def __str__(self) -> str:
        return str(self.value)
