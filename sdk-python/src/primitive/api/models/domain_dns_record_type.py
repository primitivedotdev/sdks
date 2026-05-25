from enum import Enum

class DomainDnsRecordType(str, Enum):
    MX = "MX"
    TXT = "TXT"

    def __str__(self) -> str:
        return str(self.value)
