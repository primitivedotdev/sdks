from enum import StrEnum

class SemanticSearchInputMode(StrEnum):
    HYBRID = "hybrid"
    KEYWORD = "keyword"
    SEMANTIC = "semantic"

    def __str__(self) -> str:
        return str(self.value)
