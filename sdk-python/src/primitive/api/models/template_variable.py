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
            default (str | Unset):
            file (str | Unset):
            options (list[str] | Unset):
            validation (TemplateVariableValidation | Unset):
     """

    key: str
    prompt: str
    type_: TemplateVariableType = TemplateVariableType.STRING
    default: str | Unset = UNSET
    file: str | Unset = UNSET
    options: list[str] | Unset = UNSET
    validation: TemplateVariableValidation | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.template_variable_validation import TemplateVariableValidation
        key = self.key

        prompt = self.prompt

        type_ = self.type_.value

        default = self.default

        file = self.file

        options: list[str] | Unset = UNSET
        if not isinstance(self.options, Unset):
            options = self.options



        validation: dict[str, Any] | Unset = UNSET
        if not isinstance(self.validation, Unset):
            validation = self.validation.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "prompt": prompt,
            "type": type_,
        })
        if default is not UNSET:
            field_dict["default"] = default
        if file is not UNSET:
            field_dict["file"] = file
        if options is not UNSET:
            field_dict["options"] = options
        if validation is not UNSET:
            field_dict["validation"] = validation

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_variable_validation import TemplateVariableValidation
        d = dict(src_dict)
        key = d.pop("key")

        prompt = d.pop("prompt")

        type_ = TemplateVariableType(d.pop("type"))




        default = d.pop("default", UNSET)

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
            default=default,
            file=file,
            options=options,
            validation=validation,
        )

        return template_variable

