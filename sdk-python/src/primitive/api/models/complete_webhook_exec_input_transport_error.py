from enum import StrEnum

class CompleteWebhookExecInputTransportError(StrEnum):
    IO = "io"
    TIMEOUT = "timeout"

    def __str__(self) -> str:
        return str(self.value)
