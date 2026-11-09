from enum import StrEnum

class DecideAccessModeRequestDecisionsItemKind(StrEnum):
    API_KEY = "api_key"
    ENDPOINT = "endpoint"
    FILTER_RULE = "filter_rule"
    FUNCTION = "function"
    FUNCTION_TRIGGER = "function_trigger"
    GITHUB_BINDING = "github_binding"
    MAILBOX_LOSS = "mailbox_loss"
    MAILBOX_SELF_GRANT = "mailbox_self_grant"
    PULL_SUBSCRIPTION = "pull_subscription"
    RECIPIENT_ROUTE = "recipient_route"
    RULE2_FUNCTION = "rule2_function"
    RULE2_KEY = "rule2_key"
    RULE2_OAUTH_GRANT = "rule2_oauth_grant"
    WAKE_SCHEDULE = "wake_schedule"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "DecideAccessModeRequestDecisionsItemKind | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
