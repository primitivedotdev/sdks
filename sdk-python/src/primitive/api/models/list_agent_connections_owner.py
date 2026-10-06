from enum import StrEnum

class ListAgentConnectionsOwner(StrEnum):
    SELF = "self"

    def __str__(self) -> str:
        return str(self.value)
