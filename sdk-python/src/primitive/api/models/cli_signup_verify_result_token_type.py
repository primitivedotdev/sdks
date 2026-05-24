from enum import Enum

class CliSignupVerifyResultTokenType(str, Enum):
    BEARER = "Bearer"

    def __str__(self) -> str:
        return str(self.value)
