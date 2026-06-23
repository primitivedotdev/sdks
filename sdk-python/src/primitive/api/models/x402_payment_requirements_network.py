from enum import Enum

class X402PaymentRequirementsNetwork(str, Enum):
    BASE = "base"
    BASE_SEPOLIA = "base-sepolia"

    def __str__(self) -> str:
        return str(self.value)
