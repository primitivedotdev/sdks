from enum import Enum

class ListEmailsExcludeFyi(str, Enum):
    FALSE = "false"
    TRUE = "true"

    def __str__(self) -> str:
        return str(self.value)
