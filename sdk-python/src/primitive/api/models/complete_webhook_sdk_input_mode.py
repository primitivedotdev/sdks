from enum import StrEnum

class CompleteWebhookSdkInputMode(StrEnum):
    SDK = "sdk"

    def __str__(self) -> str:
        return str(self.value)
