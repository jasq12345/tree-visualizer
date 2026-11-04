from pydantic import BaseModel, Field, field_validator

from core.config import MAX_NODES


class TreeRequest(BaseModel):
    values: list[int] = Field(max_length=MAX_NODES)
    target: int | None = None

    @field_validator("values")
    @classmethod
    def _no_duplicates(cls, values: list[int]) -> list[int]:
        # The visualizer identifies nodes by value
        if len(values) != len(set(values)):
            raise ValueError("values must be unique")
        return values
