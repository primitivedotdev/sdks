from enum import StrEnum

class EmailRuleExpectationSampleInputExpected(StrEnum):
    MATCH = "match"
    NO_MATCH = "no_match"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "EmailRuleExpectationSampleInputExpected | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
