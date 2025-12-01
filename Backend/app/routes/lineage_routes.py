import base64
import binascii

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
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Lineage output not implemented",
        )


@router.post("/upload-zip", status_code=status.HTTP_200_OK)
async def upload_zip_route(file: UploadFile = File(...)) -> dict:
    contents = await file.read()
    build_lineage_from_zip(contents)
    return {"detail": "Lineage ZIP processed"}


@router.post("/logs", status_code=status.HTTP_200_OK)
def ingest_logs_route(payload: LogsRequest) -> dict:
    try:
        raw_bytes = base64.b64decode(payload.logs_b64)
    except binascii.Error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 logs",
        )
    logs = raw_bytes.decode("utf-8", errors="replace")
    ingest_logs(logs)
    return {"detail": "Logs ingested"}
