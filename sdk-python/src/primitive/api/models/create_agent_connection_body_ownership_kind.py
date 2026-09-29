from enum import Enum

class CreateAgentConnectionBodyOwnershipKind(str, Enum):
    PERSONAL = "personal"
    SHARED = "shared"

    def __str__(self) -> str:
        return str(self.value)
