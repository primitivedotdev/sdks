from enum import Enum

class SemanticSearchMetaMode(str, Enum):
    HYBRID = "hybrid"
    KEYWORD = "keyword"
    SEMANTIC = "semantic"

    def __str__(self) -> str:
        return str(self.value)
