from enum import StrEnum

class SemanticSearchInputIncludeItem(StrEnum):
    COVERAGE = "coverage"

    def __str__(self) -> str:
        return str(self.value)
