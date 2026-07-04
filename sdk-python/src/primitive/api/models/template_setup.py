from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="TemplateSetup")



@_attrs_define
class TemplateSetup:
    """ 
        Attributes:
            agent (str):
            prompt (str):
            produces (list[str]):
     """

    agent: str
    prompt: str
    produces: list[str]





    def to_dict(self) -> dict[str, Any]:
        agent = self.agent

        prompt = self.prompt

        produces = self.produces




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "agent": agent,
            "prompt": prompt,
            "produces": produces,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        agent = d.pop("agent")

        prompt = d.pop("prompt")

        produces = cast(list[str], d.pop("produces"))


        template_setup = cls(
            agent=agent,
            prompt=prompt,
            produces=produces,
        )

        return template_setup

