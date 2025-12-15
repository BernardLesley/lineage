from __future__ import annotations

from typing import List

from app.config.config import config
from app.schemas.metadata import TableMetadata
from app.schemas.sql_generation import SQLTextResponse
from app.services.table_metadata_service import list_tables

_NUMERIC_PREFIXES = (
    "tinyint",
    "smallint",
    "int",
    "integer",
    "bigint",
    "long",
    "float",
    "double",
    "decimal",
    "numeric",
    "short",
)


def _is_numeric_spark_type(t: str) -> bool:
    tt = (t or "").strip().lower()
    return any(tt.startswith(p) for p in _NUMERIC_PREFIXES)


def _build_metrics_select(table: TableMetadata) -> str:
    cols = table.columns or []
    metrics: List[str] = []

    for c in cols:
        col_name = c.name
        col_type = getattr(c, "type", "") or ""

        if _is_numeric_spark_type(col_type):
            metrics.append(f"sum({col_name}) as {col_name}")
        else:
            metrics.append(
                "round("
                "if(count(*)=0,0,"
                f"count(if(biwarehouse.isempty({col_name}),1,NULL))/count(*)"
                ")"
                f",2) as {col_name}"
            )

    if not metrics:
        return "count(*) as row_count"

    return ",\n    ".join(metrics)


def generate_monitor_task_sql() -> SQLTextResponse:
    """
    Builds Spark SQL that overwrites the monitor table partition pt_d='$date'
    and inserts rows with only:
      table_name, json_logs

    For each source table:
    - string columns: empty/null percentage
    - numeric columns: sum
    Multiple tables are combined via UNION ALL.
    """
    tables: List[TableMetadata] = list_tables()
    monitor_table = getattr(config, "MONITOR_TABLE", "biads.ads_hispace_data_monitor")

    if not tables:
        return SQLTextResponse(sql="-- No tables in metadata. Nothing to generate.")

    per_table_selects: List[str] = []
    for t in tables:
        metrics_sql = _build_metrics_select(t)
        per_table_selects.append(
            f"""
SELECT
  '{t.name}' as table_name,
  to_json(struct(*)) as json_logs,
    
FROM (
  SELECT
    {metrics_sql}
  FROM {t.name}
  WHERE pt_d='$date'
) x
""".strip()
        )

    union_sql = "\nUNION ALL\n".join(per_table_selects)

    full_sql = f"""
INSERT OVERWRITE TABLE {monitor_table} PARTITION(pt_d='$date')
{union_sql};
""".strip()

    return SQLTextResponse(sql=full_sql)


def generate_mlops_sql() -> SQLTextResponse:
    """
    Returns Spark SQL to read back monitor results for pt_d='$date'.
    Output columns:
      table_name, json_logs
    """
    monitor_table = getattr(config, "MONITOR_TABLE")

    sql = f"""
SELECT
  table_name,
  json_logs,
  pt_d
FROM {monitor_table}
ORDER BY table_name, pt_d;
""".strip()

    return SQLTextResponse(sql=sql)
