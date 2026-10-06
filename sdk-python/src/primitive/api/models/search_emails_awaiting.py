from enum import StrEnum

class SearchEmailsAwaiting(StrEnum):
    THEM = "them"
    YOU = "you"

    def __str__(self) -> str:
        return str(self.value)
