from enum import StrEnum

class GateFixAction(StrEnum):
    CONFIRM_DOMAIN = "confirm_domain"
    SENDER_MUST_FIX_AUTHENTICATION = "sender_must_fix_authentication"
    WAIT_FOR_INBOUND = "wait_for_inbound"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "GateFixAction | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
