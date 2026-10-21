from enum import StrEnum

class ChangeOutboundMessageDirection(StrEnum):
    OUTBOUND = "outbound"

    def __str__(self) -> str:
        return str(self.value)
