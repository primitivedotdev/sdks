from enum import StrEnum

class ImportGoogleMailMessageResultStatus(StrEnum):
    ALREADY_PRESENT = "already_present"
    IMPORTED = "imported"
    INDETERMINATE = "indeterminate"
    IN_PROGRESS = "in_progress"
    SKIPPED = "skipped"
    SUPPRESSED = "suppressed"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ImportGoogleMailMessageResultStatus | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
