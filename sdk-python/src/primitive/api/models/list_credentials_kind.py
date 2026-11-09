from enum import StrEnum

class ListCredentialsKind(StrEnum):
    AGENT_DELEGATE = "agent_delegate"
    CLI_USER_ACCESS = "cli_user_access"
    CONNECTED_KEY = "connected_key"
    FUNCTION_KEY = "function_key"
    OAUTH = "oauth"
    ORG_KEY = "org_key"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ListCredentialsKind | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
