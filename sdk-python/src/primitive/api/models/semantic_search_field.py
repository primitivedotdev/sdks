from enum import StrEnum

class SemanticSearchField(StrEnum):
    ADDRESSES = "addresses"
    BODY = "body"
    HEADERS = "headers"
    SUBJECT = "subject"

    def __str__(self) -> str:
        return str(self.value)
