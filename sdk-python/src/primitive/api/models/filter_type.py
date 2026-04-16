from enum import Enum

class FilterType(str, Enum):
    BLOCKLIST = "blocklist"
    WHITELIST = "whitelist"

    def __str__(self) -> str:
        return str(self.value)
