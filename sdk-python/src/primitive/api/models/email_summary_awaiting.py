from enum import Enum

class EmailSummaryAwaiting(str, Enum):
    THEM = "them"
    YOU = "you"

    def __str__(self) -> str:
        return str(self.value)
