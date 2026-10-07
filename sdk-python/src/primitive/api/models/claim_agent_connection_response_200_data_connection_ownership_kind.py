from enum import StrEnum

class ClaimAgentConnectionResponse200DataConnectionOwnershipKind(StrEnum):
    LEGACY_UNKNOWN = "legacy_unknown"
    PERSONAL = "personal"
    SHARED = "shared"

    def __str__(self) -> str:
        return str(self.value)
