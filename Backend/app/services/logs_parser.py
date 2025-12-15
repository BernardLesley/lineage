import base64
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class LogRecord:
    """
    Example raw line:
    2025-11-14 18:58:37 main [CmdUtil.java:175] [INFO] | {table_name} | {json_logs} | {pt_d} |
    """

    table_name: str
    payload: Dict[str, Any]
    date: str


def _parse_log_line(line: str) -> Optional[LogRecord]:
    parts = line.split("|")
    if len(parts) < 4:
        return None

    table_name = parts[1].strip()
    json_logs = parts[2].strip()
    date = parts[3].strip()

    try:
        payload = json.loads(json_logs)
    except json.JSONDecodeError:
        return None

    return LogRecord(table_name=table_name, payload=payload, date=date)


def _decode_logs(b64_text: str) -> str:
    try:
        return base64.b64decode(b64_text).decode("utf-8", errors="replace")
    except Exception as e:
        raise ValueError(f"Failed to decode base64 logs: {e}")


def parse_log(base64_log: str) -> Dict[str, Dict[str, Dict[str, float]]]:
    """
    Returns:
      {
        "table_name": {
          "colname": {
            "YYYYMMDD": 123.0
          }
        }
      }
    """
    log_content = _decode_logs(base64_log)

    records: List[LogRecord] = []
    for line in log_content.splitlines():
        record = _parse_log_line(line)
        if record is not None:
            records.append(record)

    result: Dict[str, Dict[str, Dict[str, float]]] = {}

    for record in records:
        table = record.table_name
        date = str(record.date)
        payload = record.payload

        if table not in result:
            result[table] = {}

        for colname, count in payload.items():
            if colname not in result[table]:
                result[table][colname] = {}
            result[table][colname][date] = float(count)

    return result
