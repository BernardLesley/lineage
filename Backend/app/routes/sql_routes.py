from app.schemas.sql_generation import SQLTextResponse
from app.services.sql_generation_service import (
    generate_mlops_sql,
    generate_monitor_task_sql,
)
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/v1/sql", tags=["sql-generation"])


@router.get("/monitor-task", response_model=SQLTextResponse)
def generate_monitor_task_sql_route() -> SQLTextResponse:
    try:
        return generate_monitor_task_sql()
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Monitor task SQL generation not implemented",
        )


@router.get("/mlops", response_model=SQLTextResponse)
def generate_mlops_sql_route() -> SQLTextResponse:
    try:
        return generate_mlops_sql()
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="MLOps SQL generation not implemented",
        )
