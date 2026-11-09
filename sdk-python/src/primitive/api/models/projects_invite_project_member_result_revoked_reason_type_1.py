from enum import StrEnum

class ProjectsInviteProjectMemberResultRevokedReasonType1(StrEnum):
    ACCEPTED_AFTER_INVITER_DEPARTED = "accepted_after_inviter_departed"
    INVITER_DEPARTED = "inviter_departed"
    INVITER_LOST_PERMISSION = "inviter_lost_permission"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ProjectsInviteProjectMemberResultRevokedReasonType1 | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
