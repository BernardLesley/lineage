from typing import List

from app.schemas.metadata import TableMetadata, TableMetadataUpdate
from app.services.table_metadata_service import (
    delete_table,
    get_table,
    list_tables,
    patch_table,
    upsert_table,
)
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/v1/metadata/tables", tags=["table-metadata"])


@router.get("", response_model=List[TableMetadata])
def list_tables_route() -> List[TableMetadata]:
    try:
        return list_tables()
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Table list not implemented",
        )


@router.get("/{table_name}", response_model=TableMetadata)
def get_table_route(table_name: str) -> TableMetadata:
    try:
        table = get_table(table_name)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get table not implemented",
        )
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' not found",
        )
    return table


@router.post("", response_model=TableMetadata)
def create_or_upsert_table_route(table: TableMetadata) -> TableMetadata:
    try:
        return upsert_table(table)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Upsert table not implemented",
        )


@router.patch("/{table_name}", response_model=TableMetadata)
def update_table_route(table_name: str, patch: TableMetadataUpdate) -> TableMetadata:
    try:
        updated = patch_table(table_name, patch)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Patch table not implemented",
        )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' not found",
        )
    return updated


@router.delete("/{table_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table_route(table_name: str) -> None:
    try:
        ok = delete_table(table_name)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Delete table not implemented",
        )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' not found",
        )
