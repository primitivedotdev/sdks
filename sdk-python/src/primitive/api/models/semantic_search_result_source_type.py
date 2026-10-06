from enum import StrEnum

class SemanticSearchResultSourceType(StrEnum):
    INBOUND_EMAIL = "inbound_email"
    SENT_EMAIL = "sent_email"

    def __str__(self) -> str:
        return str(self.value)
