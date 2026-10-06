from enum import StrEnum

class SearchMemoriesScopeType(StrEnum):
    FUNCTION = "function"
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
