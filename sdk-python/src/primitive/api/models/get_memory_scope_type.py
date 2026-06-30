from enum import Enum

class GetMemoryScopeType(str, Enum):
    FUNCTION = "function"
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
