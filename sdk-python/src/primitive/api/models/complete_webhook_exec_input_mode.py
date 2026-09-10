from enum import Enum

class CompleteWebhookExecInputMode(str, Enum):
    EXEC = "exec"

    def __str__(self) -> str:
        return str(self.value)
