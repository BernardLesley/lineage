from pathlib import Path

from pydantic_settings import BaseSettings


class Config(BaseSettings):
    BASE_DIR: Path = Path(__file__).resolve().parents[2]
    DATA_DIR: Path = BASE_DIR / "data"
    LINEAGE_FILE: Path = DATA_DIR / "lineage.json"
    TABLE_METADATA_FILE: Path = DATA_DIR / "table_metadata.json"
    DASHBOARD_METADATA_FILE: Path = DATA_DIR / "dashboard_metadata.json"
    DEBUG: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


config = Config()
