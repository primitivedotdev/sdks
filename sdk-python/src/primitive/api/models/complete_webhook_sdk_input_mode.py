from enum import Enum

class CompleteWebhookSdkInputMode(str, Enum):
    SDK = "sdk"

    def __str__(self) -> str:
        return str(self.value)
