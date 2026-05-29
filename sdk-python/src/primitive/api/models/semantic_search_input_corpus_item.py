from enum import Enum

class SemanticSearchInputCorpusItem(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"

    def __str__(self) -> str:
        return str(self.value)
