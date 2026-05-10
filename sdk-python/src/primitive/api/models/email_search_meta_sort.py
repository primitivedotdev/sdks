from enum import Enum

class EmailSearchMetaSort(str, Enum):
    RECEIVED_AT_ASC = "received_at_asc"
    RECEIVED_AT_DESC = "received_at_desc"
    RELEVANCE = "relevance"

    def __str__(self) -> str:
        return str(self.value)
