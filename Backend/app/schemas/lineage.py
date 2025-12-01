from typing import Any, Dict

from pydantic import BaseModel


class LineageData(BaseModel):
    data: Dict[str, Any]


class LogsRequest(BaseModel):
    logs_b64: str
