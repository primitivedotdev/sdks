from enum import StrEnum

class EmailSummaryTruncatedFieldsItem(StrEnum):
    BODY_HTML = "body_html"
    BODY_TEXT = "body_text"

    def __str__(self) -> str:
        return str(self.value)
