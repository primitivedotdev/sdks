from enum import Enum

class CliLoginPollResultAuthMethod(str, Enum):
    OAUTH = "oauth"

    def __str__(self) -> str:
        return str(self.value)
