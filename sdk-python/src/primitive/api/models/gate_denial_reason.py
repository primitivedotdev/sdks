from enum import StrEnum

class GateDenialReason(StrEnum):
    DOMAIN_NOT_CONFIRMED = "domain_not_confirmed"
    RECIPIENT_NOT_KNOWN = "recipient_not_known"
    RECIPIENT_UNAUTHENTICATED = "recipient_unauthenticated"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "GateDenialReason | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
