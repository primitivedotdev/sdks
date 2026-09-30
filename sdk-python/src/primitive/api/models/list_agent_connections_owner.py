from enum import Enum

class ListAgentConnectionsOwner(str, Enum):
    SELF = "self"

    def __str__(self) -> str:
        return str(self.value)
