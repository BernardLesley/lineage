from __future__ import annotations

import time
from typing import Dict, List, Optional, Union

from sqlglot import exp, parse_one

from .column_lineage_no_conn import ColumnLineageNoConn
from .sql_to_dict import SqlToDict


def parse_one_sql(sql: str, preferred_dialect: str = "spark"):
    dialects = [preferred_dialect, "spark", "hive", "postgres", "mysql", "sqlite", ""]
    for d in dialects:
        try:
            return parse_one(sql, read=d) if d != "" else parse_one(sql)
        except Exception:
            continue
    raise ValueError("Failed to parse SQL with all fallback dialects")


def _to_monitor_json(output_dict: Dict) -> Dict:
    def norm_lineage(val) -> List[str]:
        if not val:
            return [""]
        if (
            isinstance(val, list)
            and len(val) == 2
            and isinstance(val[0], list)
            and isinstance(val[1], list)
        ):
            raw = val[0] + val[1]
        elif isinstance(val, list):
            raw = val
        else:
            raw = []
        cleaned = []
        for x in raw:
            if not x:
                continue
            if not isinstance(x, str):
                continue
            sx = x.strip()
            if not sx:
                continue
            cleaned.append(sx)
        if not cleaned:
            return [""]
        return sorted(set(cleaned))

    out: Dict = {}
    for table_name, info in output_dict.items():
        tables = info.get("tables", [""])
        sql = info.get("sql", "this is a base table")
        cols = info.get("columns", {})
        col_out = {}
        for col_name, lineage_val in cols.items():
            col_out[col_name] = {"lineage": norm_lineage(lineage_val), "count_data": {}}
        out[table_name] = {"tables": tables, "sql": sql, "columns": col_out}
    return out


class LineageXNoConn:
    def __init__(
        self,
        sql: Union[List[str], str],
        dialect: str = "spark",
        target_schema: str = "default",
        search_path_schema: str = "default",
        input_table_dict: Optional[dict] = None,
    ) -> None:
        self.output_dict: Dict = {}
        self.parsed = 0
        self.target_schema = target_schema
        self.dialect = dialect

        self.input_table_dict = input_table_dict or {}

        schema_list = [
            x.strip() for x in (search_path_schema or "").split(",") if x.strip()
        ]
        if target_schema and target_schema not in schema_list:
            schema_list.append(target_schema)

        s2d = SqlToDict(path=sql, dialect=dialect)
        self.sql_files_dict = s2d.sql_files_dict
        self.org_sql_files_dict = s2d.org_sql_files_dict

        self.finished_list: List[str] = []
        self._find_lineage_no_conn()

    def _find_lineage_no_conn(self) -> None:
        not_parsed = 0
        start_time = time.time()

        for name, sql in self.sql_files_dict.items():
            try:
                sql_ast = parse_one_sql(sql, preferred_dialect=self.dialect)
                all_tables = self._resolve_table(part_ast=sql_ast)
                for t in all_tables:
                    if t in self.sql_files_dict and t not in self.finished_list:
                        self._run_lineage_no_conn(name=t, sql=self.sql_files_dict[t])
                        self.finished_list.append(t)
                if name not in self.finished_list:
                    self._run_lineage_no_conn(name=name, sql=sql)
                    self.finished_list.append(name)
            except Exception as e:
                print(f"{name} is not processed because it encountered {e}")
                not_parsed += 1

        self._guess_schema_name()
        print(
            f"{self.parsed} SQLs are parsed, {not_parsed} SQLs are not parsed, took {time.time() - start_time:.1f}s"
        )

        self.output_dict = _to_monitor_json(self._produce_base_tables(self.output_dict))

    def _run_lineage_no_conn(self, name: str, sql: str) -> None:
        self.parsed += 1
        col_lineage = ColumnLineageNoConn(
            sql=sql, dialect=self.dialect, input_table_dict=self.input_table_dict
        )

        self.output_dict[name] = {
            "tables": (
                sorted(set(col_lineage.table_list)) if col_lineage.table_list else [""]
            ),
            "columns": col_lineage.column_dict,
            "sql": sql,
        }

        self.input_table_dict[name] = list(col_lineage.column_dict.keys())

    def _resolve_table(self, part_ast) -> List[str]:
        temp_table_list: List[str] = []
        for table_sql in part_ast.find_all(exp.From):
            for table in table_sql.find_all(exp.Table):
                temp_table_list = self._find_table(
                    table=table, temp_table_list=temp_table_list
                )
        for table_sql in part_ast.find_all(exp.Join):
            for table in table_sql.find_all(exp.Table):
                temp_table_list = self._find_table(
                    table=table, temp_table_list=temp_table_list
                )
        return temp_table_list

    def _find_table(
        self, table, temp_table_list: Optional[List[str]] = None
    ) -> List[str]:
        temp_table_list = temp_table_list or []
        if table.alias == "":
            temp_table_list.append(table.sql())
        else:
            temp = table.sql().split(" ")
            if len(temp) >= 2 and (temp[1].lower() == "as"):
                temp_table_list.append(temp[0])
        return temp_table_list

    def _guess_schema_name(self) -> None:
        all_tables: List[str] = []
        for _, val in self.output_dict.items():
            all_tables.extend(val.get("tables", []))
        all_tables = list(set(all_tables))
        tables_dict = {t.split(".")[-1]: t for t in all_tables if t}

        for key, val in list(self.output_dict.items()):
            if key in tables_dict and tables_dict[key] != key:
                self.output_dict[tables_dict[key]] = val
                self.output_dict.pop(key)

    def _produce_base_tables(self, output_dict: Dict) -> Dict:
        all_tables: List[str] = []
        for _, val in output_dict.items():
            all_tables.extend(val.get("tables", []))

        all_tables = list(set(t for t in all_tables if t) - set(output_dict.keys()))
        base_cols_guess = self._guess_base_table(output_dict)

        for t in list(all_tables):
            cols = base_cols_guess.get(t, [])
            output_dict[t] = {
                "tables": [""],
                "columns": {c: [[""], [""]] for c in cols},
                "sql": "this is a base table",
            }
        return output_dict

    def _guess_base_table(self, output_dict: Dict) -> Dict[str, List[str]]:
        base_table_cols: Dict[str, List[str]] = {}
        for _, val in output_dict.items():
            cols = list(val.get("columns", {}).values())
            for lineage_val in cols:
                if (
                    not lineage_val
                    or not isinstance(lineage_val, list)
                    or len(lineage_val) != 2
                ):
                    continue
                for tcol in lineage_val[0] + lineage_val[1]:
                    if not isinstance(tcol, str):
                        continue
                    if "." not in tcol:
                        continue
                    idx = tcol.rfind(".")
                    tname = tcol[:idx]
                    cname = tcol[idx + 1 :]
                    if not tname or not cname:
                        continue
                    base_table_cols.setdefault(tname, [])
                    if cname not in base_table_cols[tname]:
                        base_table_cols[tname].append(cname)
        return base_table_cols
