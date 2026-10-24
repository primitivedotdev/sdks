from enum import StrEnum

class CliUserLoginPollResultAuthMethod(StrEnum):
    USER_GRANT = "user_grant"

    def __str__(self) -> str:
        return str(self.value)
