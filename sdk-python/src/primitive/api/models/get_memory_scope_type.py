from enum import StrEnum

class GetMemoryScopeType(StrEnum):
    FUNCTION = "function"
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
