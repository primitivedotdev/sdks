from enum import StrEnum

class PublishPolicy(StrEnum):
    OPEN = "open"
    OWNER_ONLY = "owner_only"
    REQUEST = "request"

    def __str__(self) -> str:
        return str(self.value)
