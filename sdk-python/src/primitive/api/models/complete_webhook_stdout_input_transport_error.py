from enum import Enum

class CompleteWebhookStdoutInputTransportError(str, Enum):
    IO = "io"

    def __str__(self) -> str:
        return str(self.value)
