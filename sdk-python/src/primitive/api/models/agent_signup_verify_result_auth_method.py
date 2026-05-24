from enum import Enum

class AgentSignupVerifyResultAuthMethod(str, Enum):
    OAUTH = "oauth"

    def __str__(self) -> str:
        return str(self.value)
