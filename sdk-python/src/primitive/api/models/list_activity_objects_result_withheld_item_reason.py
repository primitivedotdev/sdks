from enum import StrEnum

class ListActivityObjectsResultWithheldItemReason(StrEnum):
    MAIL_SCOPE = "mail_scope"
    NOT_FOR_THIS_CREDENTIAL = "not_for_this_credential"
    PERMISSION_MISSING = "permission_missing"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ListActivityObjectsResultWithheldItemReason | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
