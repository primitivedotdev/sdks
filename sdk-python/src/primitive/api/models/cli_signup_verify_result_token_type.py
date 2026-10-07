from enum import StrEnum

class CliSignupVerifyResultTokenType(StrEnum):
    BEARER = "Bearer"

    def __str__(self) -> str:
        return str(self.value)
