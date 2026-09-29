from enum import Enum

class ListEmailsAwaiting(str, Enum):
    THEM = "them"
    YOU = "you"

    def __str__(self) -> str:
        return str(self.value)
