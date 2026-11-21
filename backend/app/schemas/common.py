from typing import Any, Generic, TypeVar
from pydantic import BaseModel
T = TypeVar("T")
class Envelope(BaseModel, Generic[T]):
    data: T
    meta: dict[str, Any] | None = None
class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any | None = None
class ErrorResponse(BaseModel):
    error: ErrorBody
