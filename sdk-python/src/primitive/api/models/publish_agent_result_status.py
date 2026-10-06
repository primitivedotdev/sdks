from enum import StrEnum

class PublishAgentResultStatus(StrEnum):
    APPROVED = "approved"
    REQUESTED = "requested"

    def __str__(self) -> str:
        return str(self.value)
