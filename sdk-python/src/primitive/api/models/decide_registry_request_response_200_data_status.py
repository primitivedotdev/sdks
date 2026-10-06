from enum import StrEnum

class DecideRegistryRequestResponse200DataStatus(StrEnum):
    APPROVED = "approved"
    REJECTED = "rejected"

    def __str__(self) -> str:
        return str(self.value)
