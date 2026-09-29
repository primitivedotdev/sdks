from enum import Enum

class CreateAgentConnectionResponse200DataConnectionStatus(str, Enum):
    CLAIMED = "claimed"
    CONNECTED = "connected"
    PENDING = "pending"
    REVOKED = "revoked"

    def __str__(self) -> str:
        return str(self.value)
