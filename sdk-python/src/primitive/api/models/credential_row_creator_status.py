from enum import StrEnum

class CredentialRowCreatorStatus(StrEnum):
    AGENT_BEFORE_CLAIM = "agent_before_claim"
    DEPARTED = "departed"
    MEMBER = "member"
    SYSTEM = "system"
    UNKNOWN = "unknown"

    def __str__(self) -> str:
        return str(self.value)
