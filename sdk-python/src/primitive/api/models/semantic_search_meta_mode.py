from enum import StrEnum

class SemanticSearchMetaMode(StrEnum):
    HYBRID = "hybrid"
    KEYWORD = "keyword"
    SEMANTIC = "semantic"

    def __str__(self) -> str:
        return str(self.value)
