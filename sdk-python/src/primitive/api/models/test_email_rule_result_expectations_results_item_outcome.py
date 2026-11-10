from enum import StrEnum

class TestEmailRuleResultExpectationsResultsItemOutcome(StrEnum):
    MATCHED = "matched"
    NEAR_MISS = "near_miss"
    NOT_FOUND = "not_found"
    NO_MATCH = "no_match"
    UNCLASSIFIED = "unclassified"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "TestEmailRuleResultExpectationsResultsItemOutcome | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
