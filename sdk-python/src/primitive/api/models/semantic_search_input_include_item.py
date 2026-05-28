from enum import Enum

class SemanticSearchInputIncludeItem(str, Enum):
    COVERAGE = "coverage"

    def __str__(self) -> str:
        return str(self.value)
