from enum import StrEnum

class CompleteWebhookHttpInputTransportError(StrEnum):
    IO = "io"
    NETWORK = "network"
    RESPONSE_TOO_LARGE = "response_too_large"
    TIMEOUT = "timeout"

    def __str__(self) -> str:
        return str(self.value)
