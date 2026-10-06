from enum import StrEnum

class CompleteWebhookStdoutInputTransportError(StrEnum):
    IO = "io"

    def __str__(self) -> str:
        return str(self.value)
