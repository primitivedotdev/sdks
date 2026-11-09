from enum import StrEnum

class FunctionDetailTestReadinessReason(StrEnum):
    NOT_PERMITTED = "not_permitted"
    NO_ENDPOINT = "no_endpoint"
    NO_INBOUND_DOMAIN = "no_inbound_domain"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "FunctionDetailTestReadinessReason | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
