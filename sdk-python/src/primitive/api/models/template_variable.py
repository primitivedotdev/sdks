from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.template_variable_type import TemplateVariableType
from typing import cast

if TYPE_CHECKING:
  from ..models.template_variable_validation import TemplateVariableValidation





T = TypeVar("T", bound="TemplateVariable")



@_attrs_define
class TemplateVariable:
    """ 
        Attributes:
            key (str):
            prompt (str):
            type_ (TemplateVariableType):  Default: TemplateVariableType.STRING.
            file (str | Unset):
            options (list[str] | Unset):
            validation (TemplateVariableValidation | Unset):
     """

    key: str
    prompt: str
    type_: TemplateVariableType = TemplateVariableType.STRING
    file: str | Unset = UNSET
    options: list[str] | Unset = UNSET
    validation: TemplateVariableValidation | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.template_variable_validation import TemplateVariableValidation # noqa: PLC0415
        key = self.key

        prompt = self.prompt

        type_ = self.type_.value

        file = self.file

        options: list[str] | Unset = UNSET
        if not isinstance(self.options, Unset):
            options = self.options



        validation: dict[str, Any] | Unset = UNSET
        if not isinstance(self.validation, Unset):
            validation = self.validation.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "key": key,
            "prompt": prompt,
            "type": type_,
        })
        if file is not UNSET:
            field_dict["file"] = file
        if options is not UNSET:
            field_dict["options"] = options
        if validation is not UNSET:
            field_dict["validation"] = validation

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_variable_validation import TemplateVariableValidation # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        prompt = d.pop("prompt")

        type_ = TemplateVariableType(d.pop("type"))




        file = d.pop("file", UNSET)

        options = cast(list[str], d.pop("options", UNSET))


        _validation = d.pop("validation", UNSET)
        validation: TemplateVariableValidation | Unset
        if isinstance(_validation,  Unset):
            validation = UNSET
        else:
            validation = TemplateVariableValidation.from_dict(_validation)




        template_variable = cls(
            key=key,
            prompt=prompt,
            type_=type_,
            file=file,
            options=options,
            validation=validation,
        )


        template_variable.additional_properties = d
        return template_variable

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
