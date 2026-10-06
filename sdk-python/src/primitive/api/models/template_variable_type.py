from enum import StrEnum

class TemplateVariableType(StrEnum):
    EMAIL = "email"
    SELECT = "select"
    STRING = "string"
    URL = "url"

    def __str__(self) -> str:
        return str(self.value)
