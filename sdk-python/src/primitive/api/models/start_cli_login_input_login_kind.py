from enum import StrEnum

class StartCliLoginInputLoginKind(StrEnum):
    ORG = "org"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
