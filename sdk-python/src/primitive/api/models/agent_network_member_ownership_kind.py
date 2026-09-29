from enum import Enum

class AgentNetworkMemberOwnershipKind(str, Enum):
    LEGACY_UNKNOWN = "legacy_unknown"
    PERSONAL = "personal"
    SHARED = "shared"

    def __str__(self) -> str:
        return str(self.value)
