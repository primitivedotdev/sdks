from enum import StrEnum

class CreateAgentConnectionBodyOwnershipKind(StrEnum):
    PERSONAL = "personal"
    SHARED = "shared"

    def __str__(self) -> str:
        return str(self.value)
