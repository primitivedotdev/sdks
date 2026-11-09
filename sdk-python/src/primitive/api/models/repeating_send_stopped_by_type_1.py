from enum import StrEnum

class RepeatingSendStoppedByType1(StrEnum):
    RECIPIENT = "recipient"
    SENDER = "sender"
    SYSTEM = "system"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "RepeatingSendStoppedByType1 | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
