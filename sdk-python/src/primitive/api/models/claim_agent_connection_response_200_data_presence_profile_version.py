from enum import IntEnum

class ClaimAgentConnectionResponse200DataPresenceProfileVersion(IntEnum):
    VALUE_1 = 1

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ClaimAgentConnectionResponse200DataPresenceProfileVersion | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, int):
            return None
        member = int.__new__(cls, value)
        member._name_ = str(value)
        member._value_ = value
        return member
