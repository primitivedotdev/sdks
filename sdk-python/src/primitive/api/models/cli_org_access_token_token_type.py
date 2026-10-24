from enum import StrEnum

class CliOrgAccessTokenTokenType(StrEnum):
    BEARER = "Bearer"

    def __str__(self) -> str:
        return str(self.value)
