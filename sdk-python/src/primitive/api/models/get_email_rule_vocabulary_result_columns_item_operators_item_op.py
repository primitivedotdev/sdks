from enum import StrEnum

class GetEmailRuleVocabularyResultColumnsItemOperatorsItemOp(StrEnum):
    AFTER = "after"
    BEFORE = "before"
    BETWEEN = "between"
    CONTAINS = "contains"
    CONTAINS_ALL = "contains_all"
    CONTAINS_ANY = "contains_any"
    ENDS_WITH = "ends_with"
    EQ = "eq"
    GT = "gt"
    GTE = "gte"
    IN = "in"
    IS_EMPTY = "is_empty"
    IS_FALSE = "is_false"
    IS_NULL = "is_null"
    IS_TRUE = "is_true"
    LT = "lt"
    LTE = "lte"
    NOT_EMPTY = "not_empty"
    NOT_NULL = "not_null"
    STARTS_WITH = "starts_with"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "GetEmailRuleVocabularyResultColumnsItemOperatorsItemOp | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
