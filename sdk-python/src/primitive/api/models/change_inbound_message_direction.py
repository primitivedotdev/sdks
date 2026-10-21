from enum import StrEnum

class ChangeInboundMessageDirection(StrEnum):
    INBOUND = "inbound"

    def __str__(self) -> str:
        return str(self.value)
