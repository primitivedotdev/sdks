from enum import StrEnum

class X402ReceiptStatus(StrEnum):
    SETTLED = "settled"

    def __str__(self) -> str:
        return str(self.value)
