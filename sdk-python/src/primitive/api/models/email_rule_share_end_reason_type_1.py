from enum import StrEnum

class EmailRuleShareEndReasonType1(StrEnum):
    REMOVED_BY_BENEFICIARY = "removed_by_beneficiary"
    RULE_CHANGED = "rule_changed"
    RULE_DELETED = "rule_deleted"
    STOPPED_BY_ADMIN = "stopped_by_admin"
    STOPPED_BY_GRANTER = "stopped_by_granter"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "EmailRuleShareEndReasonType1 | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
