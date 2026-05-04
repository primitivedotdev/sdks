from enum import Enum

class SendPermissionAnyRecipientType(str, Enum):
    ANY_RECIPIENT = "any_recipient"

    def __str__(self) -> str:
        return str(self.value)
