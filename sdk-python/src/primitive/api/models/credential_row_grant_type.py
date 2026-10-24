from enum import StrEnum

class CredentialRowGrantType(StrEnum):
    COMPUTED = "computed"
    CONCRETE = "concrete"
    TEMPLATE = "template"

    def __str__(self) -> str:
        return str(self.value)
