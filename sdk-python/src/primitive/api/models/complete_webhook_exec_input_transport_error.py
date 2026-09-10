from enum import Enum

class CompleteWebhookExecInputTransportError(str, Enum):
    IO = "io"
    TIMEOUT = "timeout"

    def __str__(self) -> str:
        return str(self.value)
