from enum import StrEnum

class ImportGoogleMailMessageResultReason(StrEnum):
    EXCLUDED_LABEL = "excluded_label"
    OUT_OF_WINDOW = "out_of_window"
    PROVIDER_MISSING = "provider_missing"
    TOO_LARGE = "too_large"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ImportGoogleMailMessageResultReason | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
