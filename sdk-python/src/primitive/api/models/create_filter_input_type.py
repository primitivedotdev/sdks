from enum import StrEnum

class CreateFilterInputType(StrEnum):
    BLOCKLIST = "blocklist"
    WHITELIST = "whitelist"

    def __str__(self) -> str:
        return str(self.value)
