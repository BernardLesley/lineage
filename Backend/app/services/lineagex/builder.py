from __future__ import annotations

import io
import zipfile
from typing import Dict, List, Optional, Union

from .lineage_no_conn import LineageXNoConn


def build_lineage(
    sql: Union[List[str], str],
    dialect: str = "spark",
    target_schema: str = "",
    search_path_schema: str = "",
    input_table_dict: Optional[dict] = None,
) -> Dict:
    lx = LineageXNoConn(
        sql=sql,
        dialect=dialect,
        target_schema=target_schema or "default",
        search_path_schema=search_path_schema or (target_schema or "default"),
        input_table_dict=input_table_dict,
    )
    return lx.output_dict


def build_lineage_from_zip_bytes(
    zip_bytes: bytes,
    dialect: str = "spark",
    input_table_dict: Optional[dict] = None,
) -> Dict:
    sql_list: List[str] = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            if name.lower().endswith(".sql") and not name.endswith("/"):
                sql_list.append(zf.read(name).decode("utf-8", errors="replace"))
    return build_lineage(
        sql=sql_list, dialect=dialect, input_table_dict=input_table_dict
    )
