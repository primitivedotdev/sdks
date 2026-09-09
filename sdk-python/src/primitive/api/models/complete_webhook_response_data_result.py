from enum import Enum

class CompleteWebhookResponseDataResult(str, Enum):
    ALREADY_COMPLETED = "already_completed"
    COMPLETED = "completed"

    def __str__(self) -> str:
        return str(self.value)
