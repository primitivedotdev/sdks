from enum import StrEnum

class CreateAgentConnectionResponse200DataType1ConnectionOwnershipKind(StrEnum):
    LEGACY_UNKNOWN = "legacy_unknown"
    PERSONAL = "personal"
    SHARED = "shared"

    def __str__(self) -> str:
        return str(self.value)
