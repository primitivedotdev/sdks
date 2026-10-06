from enum import StrEnum

class MemoryScopeType0Type(StrEnum):
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
