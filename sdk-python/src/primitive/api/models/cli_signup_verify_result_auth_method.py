from enum import StrEnum

class CliSignupVerifyResultAuthMethod(StrEnum):
    OAUTH = "oauth"

    def __str__(self) -> str:
        return str(self.value)
