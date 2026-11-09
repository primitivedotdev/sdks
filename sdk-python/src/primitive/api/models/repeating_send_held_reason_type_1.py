from enum import StrEnum

class RepeatingSendHeldReasonType1(StrEnum):
    CREDENTIAL_REUSE_HOLD = "credential_reuse_hold"
    SENDER_ACCESS_LOST = "sender_access_lost"
    SEND_REFUSED = "send_refused"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "RepeatingSendHeldReasonType1 | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
