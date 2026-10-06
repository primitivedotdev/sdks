from enum import StrEnum

class CliLoginPollResultAuthMethod(StrEnum):
    OAUTH = "oauth"

    def __str__(self) -> str:
        return str(self.value)
