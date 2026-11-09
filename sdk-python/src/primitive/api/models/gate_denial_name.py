from enum import StrEnum

class GateDenialName(StrEnum):
    SEND_TO_CONFIRMED_DOMAINS = "send_to_confirmed_domains"
    SEND_TO_KNOWN_ADDRESSES = "send_to_known_addresses"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "GateDenialName | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
