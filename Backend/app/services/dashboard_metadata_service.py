import json
from pathlib import Path
from typing import List, Optional

from app.config.config import config
from app.schemas.metadata import DashboardMetadata, DashboardMetadataUpdate


def _read_dashboard_metadata_file(path: Path) -> List[DashboardMetadata]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        try:
            raw = json.load(f)
        except json.JSONDecodeError:
            return []
    if not isinstance(raw, list):
        return []
    return [DashboardMetadata(**item) for item in raw]


def _write_dashboard_metadata_file(path: Path, items: List[DashboardMetadata]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = [item.dict() for item in items]
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def list_dashboards() -> List[DashboardMetadata]:
    return _read_dashboard_metadata_file(config.DASHBOARD_METADATA_FILE)


def get_dashboard(name: str) -> Optional[DashboardMetadata]:
    dashboards = _read_dashboard_metadata_file(config.DASHBOARD_METADATA_FILE)
    for d in dashboards:
        if d.name == name:
            return d
    return None


def upsert_dashboard(dashboard: DashboardMetadata) -> DashboardMetadata:
    dashboards = _read_dashboard_metadata_file(config.DASHBOARD_METADATA_FILE)
    updated: List[DashboardMetadata] = []
    found = False
    for d in dashboards:
        if d.name == dashboard.name:
            updated.append(dashboard)
            found = True
        else:
            updated.append(d)
    if not found:
        updated.append(dashboard)
    _write_dashboard_metadata_file(config.DASHBOARD_METADATA_FILE, updated)
    return dashboard


def patch_dashboard(name: str, patch: DashboardMetadataUpdate) -> Optional[DashboardMetadata]:
    dashboards = _read_dashboard_metadata_file(config.DASHBOARD_METADATA_FILE)
    new_dashboards: List[DashboardMetadata] = []
    updated_dashboard: Optional[DashboardMetadata] = None
    patch_data = patch.dict(exclude_unset=True)
    for d in dashboards:
        if d.name == name:
            base = d.dict()
            base.update(patch_data)
            updated_dashboard = DashboardMetadata(**base)
            new_dashboards.append(updated_dashboard)
        else:
            new_dashboards.append(d)
    if updated_dashboard is None:
        return None
    _write_dashboard_metadata_file(config.DASHBOARD_METADATA_FILE, new_dashboards)
    return updated_dashboard


def delete_dashboard(name: str) -> bool:
    dashboards = _read_dashboard_metadata_file(config.DASHBOARD_METADATA_FILE)
    new_dashboards = [d for d in dashboards if d.name != name]
    if len(new_dashboards) == len(dashboards):
        return False
    _write_dashboard_metadata_file(config.DASHBOARD_METADATA_FILE, new_dashboards)
    return True
