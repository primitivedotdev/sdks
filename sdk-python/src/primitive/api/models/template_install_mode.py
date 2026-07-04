from enum import Enum

class TemplateInstallMode(str, Enum):
    DEPLOY = "deploy"
    SCAFFOLD = "scaffold"

    def __str__(self) -> str:
        return str(self.value)
