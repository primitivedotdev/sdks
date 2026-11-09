from enum import StrEnum

class GetOwnGrantResponse200DataGrantType0MailScopeType1Direction(StrEnum):
    BOTH = "both"
    INBOUND = "inbound"
    OUTBOUND = "outbound"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "GetOwnGrantResponse200DataGrantType0MailScopeType1Direction | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
