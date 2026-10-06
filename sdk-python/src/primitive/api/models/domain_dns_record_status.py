from enum import StrEnum

class DomainDnsRecordStatus(StrEnum):
    FOUND = "found"
    INCORRECT = "incorrect"
    MISSING = "missing"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
