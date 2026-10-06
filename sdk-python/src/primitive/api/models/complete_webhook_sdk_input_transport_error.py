from enum import StrEnum

class CompleteWebhookSdkInputTransportError(StrEnum):
    IO = "io"
    TIMEOUT = "timeout"

    def __str__(self) -> str:
        return str(self.value)
