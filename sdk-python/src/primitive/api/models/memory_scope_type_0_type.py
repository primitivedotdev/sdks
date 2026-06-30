from enum import Enum

class MemoryScopeType0Type(str, Enum):
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
