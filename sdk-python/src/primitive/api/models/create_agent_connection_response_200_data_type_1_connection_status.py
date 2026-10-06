from enum import StrEnum

class CreateAgentConnectionResponse200DataType1ConnectionStatus(StrEnum):
    CLAIMED = "claimed"
    CONNECTED = "connected"
    PENDING = "pending"
    REVOKED = "revoked"

    def __str__(self) -> str:
        return str(self.value)
