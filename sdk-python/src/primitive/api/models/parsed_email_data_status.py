from enum import StrEnum

class ParsedEmailDataStatus(StrEnum):
    COMPLETE = "complete"
    FAILED = "failed"

    def __str__(self) -> str:
        return str(self.value)
