from enum import StrEnum

class RevokeAgentConnectionResponse200DataConnectionStatus(StrEnum):
    CLAIMED = "claimed"
    CONNECTED = "connected"
    PENDING = "pending"
    REVOKED = "revoked"

    def __str__(self) -> str:
        return str(self.value)
