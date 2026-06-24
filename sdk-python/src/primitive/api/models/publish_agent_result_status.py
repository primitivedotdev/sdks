from enum import Enum

class PublishAgentResultStatus(str, Enum):
    APPROVED = "approved"
    REQUESTED = "requested"

    def __str__(self) -> str:
        return str(self.value)
