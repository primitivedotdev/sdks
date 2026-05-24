from enum import Enum

class CliLoginPollResultTokenType(str, Enum):
    BEARER = "Bearer"

    def __str__(self) -> str:
        return str(self.value)
