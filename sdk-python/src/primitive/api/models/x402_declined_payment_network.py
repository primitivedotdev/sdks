from enum import StrEnum

class X402DeclinedPaymentNetwork(StrEnum):
    BASE = "base"
    BASE_SEPOLIA = "base-sepolia"

    def __str__(self) -> str:
        return str(self.value)
