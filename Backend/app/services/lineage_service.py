from __future__ import annotations

import io
import json
import os
import re
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, cast

from app.config.config import Config
from app.schemas.lineage import LineageData
from app.schemas.metadata import TableMetadata
from app.services.lineagex.builder import build_lineage
from app.services.logs_parser import parse_log
from app.services.table_metadata_service import build_input_table_dict, upsert_table


def _get_lineage_file() -> Path:
    return Config().LINEAGE_FILE


def _read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(str(path))

    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return {}

    return cast(Dict[str, Any], json.loads(text))


def _atomic_write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    os.replace(tmp_path, path)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_lineage_output() -> LineageData:
    raw = _read_json(_get_lineage_file())
    return cast(LineageData, raw)


def _strip_leading_line_comment(line: str) -> str:
    s = line.lstrip()
    if s.startswith("--"):
        return s[2:].lstrip()
    return line


def _looks_like_query_start(line: str) -> bool:
    s = line.lstrip()
    if not s or s.startswith("--"):
        return False
    return (
        re.match(r"^(with|select|insert|update|delete|merge)\b", s, flags=re.IGNORECASE)
        is not None
    )


def _extract_external_table_block(sql_text: str) -> Tuple[Optional[str], str]:
    lines = sql_text.splitlines()
    start_idx: Optional[int] = None

    for i, line in enumerate(lines):
        decomment = _strip_leading_line_comment(line)
        if re.search(r"\bcreate\s+external\s+table\b", decomment, flags=re.IGNORECASE):
            start_idx = i
            break

    if start_idx is None:
        return None, sql_text

    captured: List[str] = []
    remove_idx: set[int] = set()

    seen_close_paren = False
    for j in range(start_idx, len(lines)):
        line = lines[j]
        decomment = _strip_leading_line_comment(line)
        decomment_stripped = decomment.strip()

        is_commented = line.lstrip().startswith("--")
        if ")" in decomment:
            seen_close_paren = True

        if ";" in decomment:
            captured.append(decomment)
            remove_idx.add(j)
            break

        if seen_close_paren and _looks_like_query_start(line):
            break

        if is_commented or (
            captured and (decomment_stripped or not decomment_stripped)
        ):
            captured.append(decomment)
            remove_idx.add(j)
            continue

        break

    ddl_text = "\n".join(captured).strip() if captured else None
    remaining_lines = [ln for idx, ln in enumerate(lines) if idx not in remove_idx]
    remaining_sql = "\n".join(remaining_lines).strip()

    return ddl_text, remaining_sql


def _split_top_level_commas(s: str) -> List[str]:
    parts: List[str] = []
    buf: List[str] = []
    depth = 0

    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)

        if ch == "," and depth == 0:
            part = "".join(buf).strip()
            if part:
                parts.append(part)
            buf = []
        else:
            buf.append(ch)

    tail = "".join(buf).strip()
    if tail:
        parts.append(tail)

    return parts


def _parse_external_table_ddl_to_metadata(ddl_text: str) -> Optional[Dict[str, Any]]:
    ddl = ddl_text.strip()
    if not ddl:
        return None

    m = re.search(
        r"\bcreate\s+external\s+table\s+(if\s+not\s+exists\s+)?(?P<name>[^\s(]+)",
        ddl,
        flags=re.IGNORECASE,
    )
    if not m:
        return None

    raw_name = m.group("name").strip().strip("`").strip('"')
    if not raw_name:
        return None

    start_paren = ddl.find("(", m.end())
    if start_paren == -1:
        return {"name": raw_name, "columns": []}

    i = start_paren
    depth = 0
    end_paren = -1
    while i < len(ddl):
        if ddl[i] == "(":
            depth += 1
        elif ddl[i] == ")":
            depth -= 1
            if depth == 0:
                end_paren = i
                break
        i += 1

    if end_paren == -1:
        return {"name": raw_name, "columns": []}

    cols_blob = ddl[start_paren + 1 : end_paren].strip()
    if not cols_blob:
        return {"name": raw_name, "columns": []}

    col_defs = _split_top_level_commas(cols_blob)
    columns: List[Dict[str, str]] = []

    for cdef in col_defs:
        line = cdef.strip()
        if not line:
            continue

        if re.match(
            r"^(partitioned\s+by|row\s+format|fields\s+terminated|lines\s+terminated|stored\s+as|location|tblproperties)\b",
            line,
            flags=re.IGNORECASE,
        ):
            continue

        tokens = line.split()
        if len(tokens) < 2:
            continue

        col_name = tokens[0].strip().strip("`").strip('"')
        rest = line[len(tokens[0]) :].strip()

        rest = re.split(r"\bcomment\b", rest, flags=re.IGNORECASE)[0].strip()
        if not rest:
            continue

        col_type = rest.rstrip(",").strip()
        if not col_type:
            continue

        columns.append({"name": col_name, "type": col_type})

    return {"name": raw_name, "columns": columns}


def build_lineage_from_zip(zip_bytes: bytes) -> None:
    """
    Called by /api/v1/lineage/upload-zip.

    For each .sql in the zip:
      1) Extract commented CREATE EXTERNAL TABLE block -> upsert table metadata
      2) Remove that block from SQL -> feed remaining SQL to LineageX
    """
    sql_list: List[str] = []

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            if not name.lower().endswith(".sql") or name.endswith("/"):
                continue

            text = zf.read(name).decode("utf-8", errors="replace")

            ddl_text, remaining_sql = _extract_external_table_block(text)
            if ddl_text:
                meta = _parse_external_table_ddl_to_metadata(ddl_text)
                if meta:
                    try:
                        upsert_table(TableMetadata(**meta))
                    except Exception:
                        pass

            if remaining_sql.strip():
                sql_list.append(remaining_sql)

    input_table_dict = build_input_table_dict()

    output = build_lineage(
        sql=sql_list,
        dialect="spark",
        input_table_dict=input_table_dict,
    )

    _write_json(_get_lineage_file(), output)


def ingest_logs(logs_b64: str) -> None:
    monitor = parse_log(logs_b64)

    lineage_path = _get_lineage_file()
    lineage = _read_json(lineage_path)

    for _, table_obj in lineage.items():
        if not isinstance(table_obj, dict):
            continue
        columns_obj = table_obj.get("columns")
        if not isinstance(columns_obj, dict):
            continue
        for _, col_obj in columns_obj.items():
            if isinstance(col_obj, dict):
                col_obj["count_data"] = {}

    for table_name, cols in monitor.items():
        table_obj = lineage.get(table_name)
        if not isinstance(table_obj, dict):
            continue

        columns_obj = table_obj.get("columns")
        if not isinstance(columns_obj, dict):
            continue

        for col_name, date_map in cols.items():
            col_obj = columns_obj.get(col_name)
            if not isinstance(col_obj, dict):
                continue

            col_obj["count_data"] = {}
            count_data = col_obj["count_data"]

            for dt, val in date_map.items():
                count_data[str(dt)] = float(val)

    _atomic_write_json(lineage_path, lineage)
