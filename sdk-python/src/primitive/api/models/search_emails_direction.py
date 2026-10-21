from enum import StrEnum

class SearchEmailsDirection(StrEnum):
    ANY = "any"
    INBOUND = "inbound"
    OUTBOUND = "outbound"

    def __str__(self) -> str:
        return str(self.value)
