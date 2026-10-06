from enum import StrEnum

class EmailSummaryAwaiting(StrEnum):
    THEM = "them"
    YOU = "you"

    def __str__(self) -> str:
        return str(self.value)
