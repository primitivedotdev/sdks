from enum import StrEnum

class CompleteWebhookResponseDataResult(StrEnum):
    ALREADY_COMPLETED = "already_completed"
    COMPLETED = "completed"

    def __str__(self) -> str:
        return str(self.value)
