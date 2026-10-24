from enum import StrEnum

class AccessModeMode(StrEnum):
    DELEGATED = "delegated"
    WHOLE_ORG = "whole_org"

    def __str__(self) -> str:
        return str(self.value)
