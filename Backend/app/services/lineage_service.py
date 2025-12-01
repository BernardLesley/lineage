import io
import zipfile

from app.schemas.lineage import LineageData


def get_lineage_output() -> LineageData:
    raise NotImplementedError()


def build_lineage_from_zip(zip_bytes: bytes) -> None:
    buffer = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(buffer) as zf:
        print("Received ZIP with files:")
        for name in zf.namelist():
            print(name)


def ingest_logs(logs: str) -> None:
    print("Ingested logs:")
    print(logs)
