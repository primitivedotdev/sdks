from enum import StrEnum

class DomainDnsRecordPurpose(StrEnum):
    DKIM = "dkim"
    DKIM_STANDBY = "dkim_standby"
    DMARC = "dmarc"
    INBOUND_MX = "inbound_mx"
    OWNERSHIP_VERIFICATION = "ownership_verification"
    SPF = "spf"
    TLS_REPORTING = "tls_reporting"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "DomainDnsRecordPurpose | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
