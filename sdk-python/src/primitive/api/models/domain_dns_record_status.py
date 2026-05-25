from enum import Enum

class DomainDnsRecordStatus(str, Enum):
    FOUND = "found"
    INCORRECT = "incorrect"
    MISSING = "missing"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
