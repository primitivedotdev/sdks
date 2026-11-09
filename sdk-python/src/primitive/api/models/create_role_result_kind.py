from enum import StrEnum

class CreateRoleResultKind(StrEnum):
    BUILTIN = "builtin"
    CUSTOM = "custom"
    TEMPLATE = "template"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "CreateRoleResultKind | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
