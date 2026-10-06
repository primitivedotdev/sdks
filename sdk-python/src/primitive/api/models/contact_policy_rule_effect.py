from enum import StrEnum

class ContactPolicyRuleEffect(StrEnum):
    ALLOW = "allow"
    SILENCE = "silence"

    def __str__(self) -> str:
        return str(self.value)
