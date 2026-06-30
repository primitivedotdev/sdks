from enum import Enum

class DeleteMemoryScopeType(str, Enum):
    FUNCTION = "function"
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
