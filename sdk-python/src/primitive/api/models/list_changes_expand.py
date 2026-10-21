from enum import StrEnum

class ListChangesExpand(StrEnum):
    MESSAGE = "message"

    def __str__(self) -> str:
        return str(self.value)
