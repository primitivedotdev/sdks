from enum import StrEnum

class CredentialRowActionsItem(StrEnum):
    EDIT = "edit"
    REVOKE = "revoke"
    ROTATE = "rotate"
    SUGGEST = "suggest"
    TRANSFER = "transfer"

    def __str__(self) -> str:
        return str(self.value)
