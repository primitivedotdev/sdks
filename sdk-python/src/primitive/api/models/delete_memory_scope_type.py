from enum import StrEnum

class DeleteMemoryScopeType(StrEnum):
    FUNCTION = "function"
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
