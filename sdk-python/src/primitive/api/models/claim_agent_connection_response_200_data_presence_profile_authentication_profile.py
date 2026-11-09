from enum import StrEnum

class ClaimAgentConnectionResponse200DataPresenceProfileAuthenticationProfile(StrEnum):
    PRIMITIVE_ISSUED_V1 = "primitive-issued-v1"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ClaimAgentConnectionResponse200DataPresenceProfileAuthenticationProfile | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
