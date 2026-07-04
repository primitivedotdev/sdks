from enum import Enum

class TemplateVariableType(str, Enum):
    EMAIL = "email"
    SELECT = "select"
    STRING = "string"
    URL = "url"

    def __str__(self) -> str:
        return str(self.value)
