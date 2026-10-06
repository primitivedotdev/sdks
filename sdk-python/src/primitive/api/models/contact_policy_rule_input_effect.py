from enum import StrEnum

class ContactPolicyRuleInputEffect(StrEnum):
    ALLOW = "allow"
    SILENCE = "silence"

    def __str__(self) -> str:
        return str(self.value)
