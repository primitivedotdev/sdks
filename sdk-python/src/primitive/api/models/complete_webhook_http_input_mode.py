from enum import StrEnum

class CompleteWebhookHttpInputMode(StrEnum):
    HTTP = "http"

    def __str__(self) -> str:
        return str(self.value)
