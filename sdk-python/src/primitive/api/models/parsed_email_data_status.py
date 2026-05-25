from enum import Enum

class ParsedEmailDataStatus(str, Enum):
    COMPLETE = "complete"
    FAILED = "failed"

    def __str__(self) -> str:
        return str(self.value)
