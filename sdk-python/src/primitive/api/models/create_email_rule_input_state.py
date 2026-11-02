from enum import StrEnum

class CreateEmailRuleInputState(StrEnum):
    DRAFT = "draft"
    OBSERVE = "observe"

    def __str__(self) -> str:
        return str(self.value)
