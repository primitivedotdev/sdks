from enum import StrEnum

class AgentSignupVerifyResultAuthMethod(StrEnum):
    OAUTH = "oauth"

    def __str__(self) -> str:
        return str(self.value)
