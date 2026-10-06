from enum import StrEnum

class DecideRegistryRequestInputDecision(StrEnum):
    APPROVED = "approved"
    REJECTED = "rejected"

    def __str__(self) -> str:
        return str(self.value)
