from enum import Enum

class ContactPolicyRuleInputEffect(str, Enum):
    ALLOW = "allow"
    SILENCE = "silence"

    def __str__(self) -> str:
        return str(self.value)
