from enum import StrEnum

class EmailRuleReceiversSharesItemBeneficiaryKind(StrEnum):
    MEMBER = "member"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "EmailRuleReceiversSharesItemBeneficiaryKind | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
