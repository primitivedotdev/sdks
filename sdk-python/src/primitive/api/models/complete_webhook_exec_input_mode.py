from enum import StrEnum

class CompleteWebhookExecInputMode(StrEnum):
    EXEC = "exec"

    def __str__(self) -> str:
        return str(self.value)
