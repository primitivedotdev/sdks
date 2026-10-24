from enum import StrEnum

class CliUserLoginPollResultTokenType(StrEnum):
    BEARER = "Bearer"

    def __str__(self) -> str:
        return str(self.value)
