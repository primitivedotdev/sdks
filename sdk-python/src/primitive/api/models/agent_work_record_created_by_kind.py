from enum import StrEnum

class AgentWorkRecordCreatedByKind(StrEnum):
    AGENT = "agent"
    HUMAN = "human"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "AgentWorkRecordCreatedByKind | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
