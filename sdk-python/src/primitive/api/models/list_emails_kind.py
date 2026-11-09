from enum import StrEnum

class ListEmailsKind(StrEnum):
    AUTO_REPLY = "auto_reply"
    COMPLAINT = "complaint"
    DMARC_FAILURE = "dmarc_failure"
    DMARC_REPORT = "dmarc_report"
    DSN = "dsn"
    REGULAR = "regular"
    TLS_REPORT = "tls_report"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ListEmailsKind | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
