from enum import StrEnum

class CredentialKind(StrEnum):
    AGENT_DELEGATE = "agent_delegate"
    CLI_USER_ACCESS = "cli_user_access"
    CONNECTED_KEY = "connected_key"
    FUNCTION_KEY = "function_key"
    OAUTH = "oauth"
    ORG_KEY = "org_key"

    def __str__(self) -> str:
        return str(self.value)
