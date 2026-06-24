from enum import Enum

class PublishPolicy(str, Enum):
    OPEN = "open"
    OWNER_ONLY = "owner_only"
    REQUEST = "request"

    def __str__(self) -> str:
        return str(self.value)
