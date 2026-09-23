from enum import Enum

class CompleteWebhookSdkInputTransportError(str, Enum):
    IO = "io"
    TIMEOUT = "timeout"

    def __str__(self) -> str:
        return str(self.value)
