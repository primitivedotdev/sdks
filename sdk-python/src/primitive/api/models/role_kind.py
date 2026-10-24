from enum import StrEnum

class RoleKind(StrEnum):
    BUILTIN = "builtin"
    CUSTOM = "custom"
    TEMPLATE = "template"

    def __str__(self) -> str:
        return str(self.value)
