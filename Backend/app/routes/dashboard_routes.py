from typing import List

from app.schemas.metadata import DashboardMetadata, DashboardMetadataUpdate
from app.services.dashboard_metadata_service import (
    delete_dashboard,
    get_dashboard,
    list_dashboards,
    patch_dashboard,
    upsert_dashboard,
)
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/v1/metadata/dashboards", tags=["dashboard-metadata"])


@router.get("", response_model=List[DashboardMetadata])
def list_dashboards_route() -> List[DashboardMetadata]:
    try:
        return list_dashboards()
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Dashboard list not implemented",
        )


@router.get("/{dashboard_name}", response_model=DashboardMetadata)
def get_dashboard_route(dashboard_name: str) -> DashboardMetadata:
    try:
        dashboard = get_dashboard(dashboard_name)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Get dashboard not implemented",
        )
    if dashboard is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dashboard '{dashboard_name}' not found",
        )
    return dashboard


@router.post("", response_model=DashboardMetadata)
def create_or_upsert_dashboard_route(
    dashboard: DashboardMetadata,
) -> DashboardMetadata:
    try:
        return upsert_dashboard(dashboard)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Upsert dashboard not implemented",
        )


@router.patch("/{dashboard_name}", response_model=DashboardMetadata)
def update_dashboard_route(
    dashboard_name: str,
    patch: DashboardMetadataUpdate,
) -> DashboardMetadata:
    try:
        updated = patch_dashboard(dashboard_name, patch)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Patch dashboard not implemented",
        )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dashboard '{dashboard_name}' not found",
        )
    return updated


@router.delete("/{dashboard_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dashboard_route(dashboard_name: str) -> None:
    try:
        ok = delete_dashboard(dashboard_name)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Delete dashboard not implemented",
        )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dashboard '{dashboard_name}' not found",
        )
