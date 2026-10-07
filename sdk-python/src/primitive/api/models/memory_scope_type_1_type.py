from enum import StrEnum

class MemoryScopeType1Type(StrEnum):
    FUNCTION = "function"

    def __str__(self) -> str:
        return str(self.value)
