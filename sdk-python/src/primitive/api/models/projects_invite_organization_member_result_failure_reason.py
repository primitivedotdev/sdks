from enum import StrEnum

class ProjectsInviteOrganizationMemberResultFailureReason(StrEnum):
    ALREADY_INVITED = "already_invited"
    ALREADY_MEMBER = "already_member"
    INVALID_ADDRESS = "invalid_address"
    MEMBER_LIMIT = "member_limit"
    NOT_ALLOWED = "not_allowed"
    REFUSED = "refused"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ProjectsInviteOrganizationMemberResultFailureReason | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
