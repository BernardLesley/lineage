from app.schemas.lineage import LineageData, LogsRequest
from app.services.lineage_service import (
    build_lineage_from_zip,
    get_lineage_output,
    ingest_logs,
)
from fastapi import APIRouter, File, HTTPException, UploadFile, status

router = APIRouter(prefix="/api/v1/lineage", tags=["lineage"])


@router.get("/output", response_model=LineageData)
def get_lineage_output_route() -> LineageData:
    try:
        return get_lineage_output()
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lineage output not found",
        )


@router.post("/upload-zip", status_code=status.HTTP_200_OK)
async def upload_zip_route(file: UploadFile = File(...)) -> dict:
    contents = await file.read()
    build_lineage_from_zip(contents)
    return {"detail": "Lineage ZIP processed"}


@router.post("/logs", status_code=status.HTTP_200_OK)
def ingest_logs_route(payload: LogsRequest) -> dict:
    try:
        ingest_logs(payload.logs_b64)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return {"detail": "Logs ingested"}
