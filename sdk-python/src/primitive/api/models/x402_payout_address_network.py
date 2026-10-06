from enum import StrEnum

class X402PayoutAddressNetwork(StrEnum):
    BASE = "base"
    BASE_SEPOLIA = "base-sepolia"

    def __str__(self) -> str:
        return str(self.value)
