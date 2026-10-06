from enum import StrEnum

class AgentSignupVerifyResultTokenType(StrEnum):
    BEARER = "Bearer"

    def __str__(self) -> str:
        return str(self.value)
