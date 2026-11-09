from enum import StrEnum

class TransferOwnedItemsRequestItemsItemKind(StrEnum):
    API_KEY = "api_key"
    ENDPOINT = "endpoint"
    FILTER_RULE = "filter_rule"
    FUNCTION = "function"
    FUNCTION_TRIGGER = "function_trigger"
    GITHUB_BINDING = "github_binding"
    PULL_SUBSCRIPTION = "pull_subscription"
    RECIPIENT_ROUTE = "recipient_route"
    REPEATING_SEND = "repeating_send"
    SCHEDULED_SEND = "scheduled_send"
    WAKE_SCHEDULE = "wake_schedule"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "TransferOwnedItemsRequestItemsItemKind | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
