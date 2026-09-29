from enum import Enum

class SearchEmailsAwaiting(str, Enum):
    THEM = "them"
    YOU = "you"

    def __str__(self) -> str:
        return str(self.value)
