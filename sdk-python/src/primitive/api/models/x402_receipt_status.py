from enum import Enum

class X402ReceiptStatus(str, Enum):
    SETTLED = "settled"

    def __str__(self) -> str:
        return str(self.value)
