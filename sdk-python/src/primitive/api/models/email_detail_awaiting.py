from enum import StrEnum

class EmailDetailAwaiting(StrEnum):
    THEM = "them"
    YOU = "you"

    def __str__(self) -> str:
        return str(self.value)
