import json
from pathlib import Path
from typing import List, Optional

from app.config.config import config
from app.schemas.metadata import TableMetadata, TableMetadataUpdate


def _read_table_metadata_file(path: Path) -> List[TableMetadata]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        try:
            raw = json.load(f)
        except json.JSONDecodeError:
            return []
    if not isinstance(raw, list):
        return []
    return [TableMetadata(**item) for item in raw]


def _write_table_metadata_file(path: Path, items: List[TableMetadata]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = [item.dict() for item in items]
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def list_tables() -> List[TableMetadata]:
    return _read_table_metadata_file(config.TABLE_METADATA_FILE)


def get_table(table_name: str) -> Optional[TableMetadata]:
    tables = _read_table_metadata_file(config.TABLE_METADATA_FILE)
    for t in tables:
        if t.name == table_name:
            return t
    return None


def upsert_table(table: TableMetadata) -> TableMetadata:
    tables = _read_table_metadata_file(config.TABLE_METADATA_FILE)
    updated: List[TableMetadata] = []
    found = False
    for t in tables:
        if t.name == table.name:
            updated.append(table)
            found = True
        else:
            updated.append(t)
    if not found:
        updated.append(table)
    _write_table_metadata_file(config.TABLE_METADATA_FILE, updated)
    return table


def patch_table(table_name: str, patch: TableMetadataUpdate) -> Optional[TableMetadata]:
    tables = _read_table_metadata_file(config.TABLE_METADATA_FILE)
    new_tables: List[TableMetadata] = []
    updated_table: Optional[TableMetadata] = None
    patch_data = patch.dict(exclude_unset=True)
    for t in tables:
        if t.name == table_name:
            base = t.dict()
            base.update(patch_data)
            updated_table = TableMetadata(**base)
            new_tables.append(updated_table)
        else:
            new_tables.append(t)
    if updated_table is None:
        return None
    _write_table_metadata_file(config.TABLE_METADATA_FILE, new_tables)
    return updated_table


def delete_table(table_name: str) -> bool:
    tables = _read_table_metadata_file(config.TABLE_METADATA_FILE)
    new_tables = [t for t in tables if t.name != table_name]
    if len(new_tables) == len(tables):
        return False
    _write_table_metadata_file(config.TABLE_METADATA_FILE, new_tables)
    return True
