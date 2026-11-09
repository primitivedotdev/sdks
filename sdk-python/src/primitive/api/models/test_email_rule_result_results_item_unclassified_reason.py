from enum import StrEnum

class TestEmailRuleResultResultsItemUnclassifiedReason(StrEnum):
    CLASSIFICATION_FAILED = "classification_failed"
    CLASSIFIER_UNAVAILABLE = "classifier_unavailable"
    NOT_CLASSIFIABLE = "not_classifiable"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "TestEmailRuleResultResultsItemUnclassifiedReason | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
