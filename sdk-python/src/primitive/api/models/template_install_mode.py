from enum import StrEnum

class TemplateInstallMode(StrEnum):
    DEPLOY = "deploy"
    SCAFFOLD = "scaffold"

    def __str__(self) -> str:
        return str(self.value)
