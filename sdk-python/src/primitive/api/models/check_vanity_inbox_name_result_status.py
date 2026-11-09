from enum import StrEnum

class CheckVanityInboxNameResultStatus(StrEnum):
    AVAILABLE = "available"
    INVALID = "invalid"
    RESERVED = "reserved"
    TAKEN = "taken"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "CheckVanityInboxNameResultStatus | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
