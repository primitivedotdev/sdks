from enum import Enum

class DecideRegistryRequestResponse200DataStatus(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"

    def __str__(self) -> str:
        return str(self.value)
