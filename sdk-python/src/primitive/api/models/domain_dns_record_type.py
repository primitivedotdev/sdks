from enum import StrEnum

class DomainDnsRecordType(StrEnum):
    MX = "MX"
    TXT = "TXT"

    def __str__(self) -> str:
        return str(self.value)
