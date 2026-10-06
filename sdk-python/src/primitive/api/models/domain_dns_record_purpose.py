from enum import StrEnum

class DomainDnsRecordPurpose(StrEnum):
    DKIM = "dkim"
    DMARC = "dmarc"
    INBOUND_MX = "inbound_mx"
    OWNERSHIP_VERIFICATION = "ownership_verification"
    SPF = "spf"
    TLS_REPORTING = "tls_reporting"

    def __str__(self) -> str:
        return str(self.value)
