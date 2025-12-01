from typing import List, Optional

from pydantic import BaseModel, Field


class TableColumn(BaseModel):
    name: str
    type: str


class TableMetadata(BaseModel):
    name: str
    columns: List[TableColumn] = Field(default_factory=list)


class TableMetadataUpdate(BaseModel):
    name: Optional[str] = None
    columns: Optional[List[TableColumn]] = None


class DashboardMetadata(BaseModel):
    name: str
    description: Optional[str] = None
    tables: List[str] = Field(default_factory=list)


class DashboardMetadataUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tables: Optional[List[str]] = None
