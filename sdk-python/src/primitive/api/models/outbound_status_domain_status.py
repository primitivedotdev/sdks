from enum import StrEnum

class OutboundStatusDomainStatus(StrEnum):
    INACTIVE = "inactive"
    PENDING_OUTBOUND_DNS = "pending_outbound_dns"
    PENDING_OWNERSHIP = "pending_ownership"
    SENDABLE = "sendable"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "OutboundStatusDomainStatus | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
