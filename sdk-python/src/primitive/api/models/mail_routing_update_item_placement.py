from enum import StrEnum

class MailRoutingUpdateItemPlacement(StrEnum):
    CONVERSATIONS = "conversations"
    INBOX = "inbox"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "MailRoutingUpdateItemPlacement | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
