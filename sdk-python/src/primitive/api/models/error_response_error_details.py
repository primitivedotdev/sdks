from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.error_response_error_details_mx_conflict import ErrorResponseErrorDetailsMxConflict





T = TypeVar("T", bound="ErrorResponseErrorDetails")



@_attrs_define
class ErrorResponseErrorDetails:
    """ Optional structured data that callers can inspect to recover
    from the error. The fields present depend on `code`. Additional
    keys may be added over time without a major-version bump.

        Attributes:
            mx_conflict (ErrorResponseErrorDetailsMxConflict | Unset): Present when `code == mx_conflict`.
            required_entitlements (list[str] | Unset): Entitlements that would allow a denied send when no recipient-scope
                gate was granted.
            sent_email_id (str | Unset): ID of the persisted sent-email attempt associated with the error.
            content_hash (str | Unset): Content hash of the original request on idempotency cache-hit errors.
            client_idempotency_key (str | Unset): Effective idempotency key associated with the original request.
            permission (None | str | Unset): Present when `code == grant_forbidden`. The permission the operation requires.
                See `GrantForbiddenDetails` for the full shape.
            credential_kind (None | str | Unset): Present when `code == grant_forbidden`. The kind of credential that was
                refused.
            grant_template_key (None | str | Unset): Present when `code == grant_forbidden` and the credential holds a
                template grant.
            credential_grant_id (None | str | Unset): Present when `code == grant_forbidden` and the credential holds a
                concrete grant.
            catalog_version (None | str | Unset): Present when `code == grant_forbidden`. Version of the permission catalog
                the decision used.
            reason (None | str | Unset): Present when `code == grant_forbidden` (why the grant refused) or
                `grant_not_available` (why the grant cannot be given).
            purpose (None | str | Unset): Present when `code == step_up_required`. What the step-up token must be issued
                for.
            step_up_url (None | str | Unset): Present when `code == step_up_required`. Dashboard page that issues a step-up
                token.
     """

    mx_conflict: ErrorResponseErrorDetailsMxConflict | Unset = UNSET
    required_entitlements: list[str] | Unset = UNSET
    sent_email_id: str | Unset = UNSET
    content_hash: str | Unset = UNSET
    client_idempotency_key: str | Unset = UNSET
    permission: None | str | Unset = UNSET
    credential_kind: None | str | Unset = UNSET
    grant_template_key: None | str | Unset = UNSET
    credential_grant_id: None | str | Unset = UNSET
    catalog_version: None | str | Unset = UNSET
    reason: None | str | Unset = UNSET
    purpose: None | str | Unset = UNSET
    step_up_url: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.error_response_error_details_mx_conflict import ErrorResponseErrorDetailsMxConflict # noqa: PLC0415
        mx_conflict: dict[str, Any] | Unset = UNSET
        if not isinstance(self.mx_conflict, Unset):
            mx_conflict = self.mx_conflict.to_dict()

        required_entitlements: list[str] | Unset = UNSET
        if not isinstance(self.required_entitlements, Unset):
            required_entitlements = self.required_entitlements



        sent_email_id = self.sent_email_id

        content_hash = self.content_hash

        client_idempotency_key = self.client_idempotency_key

        permission: None | str | Unset
        if isinstance(self.permission, Unset):
            permission = UNSET
        else:
            permission = self.permission

        credential_kind: None | str | Unset
        if isinstance(self.credential_kind, Unset):
            credential_kind = UNSET
        else:
            credential_kind = self.credential_kind

        grant_template_key: None | str | Unset
        if isinstance(self.grant_template_key, Unset):
            grant_template_key = UNSET
        else:
            grant_template_key = self.grant_template_key

        credential_grant_id: None | str | Unset
        if isinstance(self.credential_grant_id, Unset):
            credential_grant_id = UNSET
        else:
            credential_grant_id = self.credential_grant_id

        catalog_version: None | str | Unset
        if isinstance(self.catalog_version, Unset):
            catalog_version = UNSET
        else:
            catalog_version = self.catalog_version

        reason: None | str | Unset
        if isinstance(self.reason, Unset):
            reason = UNSET
        else:
            reason = self.reason

        purpose: None | str | Unset
        if isinstance(self.purpose, Unset):
            purpose = UNSET
        else:
            purpose = self.purpose

        step_up_url: None | str | Unset
        if isinstance(self.step_up_url, Unset):
            step_up_url = UNSET
        else:
            step_up_url = self.step_up_url


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if mx_conflict is not UNSET:
            field_dict["mx_conflict"] = mx_conflict
        if required_entitlements is not UNSET:
            field_dict["required_entitlements"] = required_entitlements
        if sent_email_id is not UNSET:
            field_dict["sent_email_id"] = sent_email_id
        if content_hash is not UNSET:
            field_dict["content_hash"] = content_hash
        if client_idempotency_key is not UNSET:
            field_dict["client_idempotency_key"] = client_idempotency_key
        if permission is not UNSET:
            field_dict["permission"] = permission
        if credential_kind is not UNSET:
            field_dict["credential_kind"] = credential_kind
        if grant_template_key is not UNSET:
            field_dict["grant_template_key"] = grant_template_key
        if credential_grant_id is not UNSET:
            field_dict["credential_grant_id"] = credential_grant_id
        if catalog_version is not UNSET:
            field_dict["catalog_version"] = catalog_version
        if reason is not UNSET:
            field_dict["reason"] = reason
        if purpose is not UNSET:
            field_dict["purpose"] = purpose
        if step_up_url is not UNSET:
            field_dict["step_up_url"] = step_up_url

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.error_response_error_details_mx_conflict import ErrorResponseErrorDetailsMxConflict # noqa: PLC0415
        d = dict(src_dict)
        _mx_conflict = d.pop("mx_conflict", UNSET)
        mx_conflict: ErrorResponseErrorDetailsMxConflict | Unset
        if isinstance(_mx_conflict,  Unset):
            mx_conflict = UNSET
        else:
            mx_conflict = ErrorResponseErrorDetailsMxConflict.from_dict(_mx_conflict)




        required_entitlements = cast(list[str], d.pop("required_entitlements", UNSET))


        sent_email_id = d.pop("sent_email_id", UNSET)

        content_hash = d.pop("content_hash", UNSET)

        client_idempotency_key = d.pop("client_idempotency_key", UNSET)

        def _parse_permission(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        permission = _parse_permission(d.pop("permission", UNSET))


        def _parse_credential_kind(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        credential_kind = _parse_credential_kind(d.pop("credential_kind", UNSET))


        def _parse_grant_template_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        grant_template_key = _parse_grant_template_key(d.pop("grant_template_key", UNSET))


        def _parse_credential_grant_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        credential_grant_id = _parse_credential_grant_id(d.pop("credential_grant_id", UNSET))


        def _parse_catalog_version(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        catalog_version = _parse_catalog_version(d.pop("catalog_version", UNSET))


        def _parse_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        reason = _parse_reason(d.pop("reason", UNSET))


        def _parse_purpose(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        purpose = _parse_purpose(d.pop("purpose", UNSET))


        def _parse_step_up_url(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        step_up_url = _parse_step_up_url(d.pop("step_up_url", UNSET))


        error_response_error_details = cls(
            mx_conflict=mx_conflict,
            required_entitlements=required_entitlements,
            sent_email_id=sent_email_id,
            content_hash=content_hash,
            client_idempotency_key=client_idempotency_key,
            permission=permission,
            credential_kind=credential_kind,
            grant_template_key=grant_template_key,
            credential_grant_id=credential_grant_id,
            catalog_version=catalog_version,
            reason=reason,
            purpose=purpose,
            step_up_url=step_up_url,
        )


        error_response_error_details.additional_properties = d
        return error_response_error_details

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
