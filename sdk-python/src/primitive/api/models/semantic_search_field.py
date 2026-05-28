from enum import Enum

class SemanticSearchField(str, Enum):
    ADDRESSES = "addresses"
    BODY = "body"
    HEADERS = "headers"
    SUBJECT = "subject"

    def __str__(self) -> str:
        return str(self.value)
