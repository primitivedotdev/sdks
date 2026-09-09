from enum import Enum

class CompleteWebhookStdoutInputMode(str, Enum):
    STDOUT = "stdout"

    def __str__(self) -> str:
        return str(self.value)
