from enum import StrEnum

class GetEmailRuleVocabularyResultColumnsItemOperatorsItemValue(StrEnum):
    DATE_TIME = "date_time"
    NONE = "none"
    NUMBER = "number"
    NUMBER_RANGE = "number_range"
    TEXT = "text"
    TEXT_LIST = "text_list"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "GetEmailRuleVocabularyResultColumnsItemOperatorsItemValue | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
