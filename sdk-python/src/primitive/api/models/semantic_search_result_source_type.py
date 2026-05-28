from enum import Enum

class SemanticSearchResultSourceType(str, Enum):
    INBOUND_EMAIL = "inbound_email"
    SENT_EMAIL = "sent_email"

    def __str__(self) -> str:
        return str(self.value)
