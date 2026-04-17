from enum import Enum

class CreateFilterInputType(str, Enum):
    BLOCKLIST = "blocklist"
    WHITELIST = "whitelist"

    def __str__(self) -> str:
        return str(self.value)
