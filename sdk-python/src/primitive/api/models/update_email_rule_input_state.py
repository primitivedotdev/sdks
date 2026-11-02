from enum import StrEnum

class UpdateEmailRuleInputState(StrEnum):
    ACTIVE = "active"
    DRAFT = "draft"
    OBSERVE = "observe"

    def __str__(self) -> str:
        return str(self.value)
