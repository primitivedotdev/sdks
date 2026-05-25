from enum import Enum

class DomainDnsRecordPurpose(str, Enum):
    DKIM = "dkim"
    DMARC = "dmarc"
    INBOUND_MX = "inbound_mx"
    OWNERSHIP_VERIFICATION = "ownership_verification"
    SPF = "spf"
    TLS_REPORTING = "tls_reporting"

    def __str__(self) -> str:
        return str(self.value)
