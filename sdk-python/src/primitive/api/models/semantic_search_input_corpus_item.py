from enum import StrEnum

class SemanticSearchInputCorpusItem(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"

    def __str__(self) -> str:
        return str(self.value)
