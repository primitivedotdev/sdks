from enum import StrEnum

class CompleteWebhookStdoutInputMode(StrEnum):
    STDOUT = "stdout"

    def __str__(self) -> str:
        return str(self.value)
