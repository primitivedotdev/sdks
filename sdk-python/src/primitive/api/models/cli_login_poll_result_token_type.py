from enum import StrEnum

class CliLoginPollResultTokenType(StrEnum):
    BEARER = "Bearer"

    def __str__(self) -> str:
        return str(self.value)
