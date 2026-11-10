from enum import StrEnum

class GetSendFromResponse200DataDefaultSourceType1(StrEnum):
    AGENT_ADDRESS = "agent_address"
    GRANTED_ADDRESS = "granted_address"
    MEMBER_ADDRESS = "member_address"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "GetSendFromResponse200DataDefaultSourceType1 | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
