from enum import StrEnum

class SendPermissionAnyRecipientType(StrEnum):
    ANY_RECIPIENT = "any_recipient"

    def __str__(self) -> str:
        return str(self.value)
