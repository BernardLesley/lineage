from __future__ import annotations

import itertools
from typing import Dict, List, Optional, Tuple, Union

from sqlglot import exp, parse_one

Expression = exp.Expression
AliasTarget = Union[str, List[str]]
Lineage = Tuple[List[str], List[str]]


shared_conditions = [
    exp.Where,
    exp.EQ,
    exp.GT,
    exp.LT,
    exp.GTE,
    exp.LTE,
    exp.Between,
    exp.In,
    exp.Not,
    exp.Group,
    exp.Having,
    exp.Order,
]
shared_conditions_with_table = shared_conditions + [exp.From, exp.Join]
from_join_exp = [exp.From, exp.Join]
compare_cond = [exp.EQ, exp.GT, exp.LT, exp.GTE, exp.LTE]


def parse_one_sql(
    sql: Optional[str] = "", preferred_dialect: str = "spark"
) -> Expression:
    sql = sql or ""
    dialects = [
        preferred_dialect,
        "spark",
        "hive",
        "postgres",
        "oracle",
        "mysql",
        "sqlite",
        "",
    ]
    last_err: Exception | None = None

    for dialect in dialects:
        try:
            if dialect:
                return parse_one(sql, read=dialect)
            return parse_one(sql)
        except Exception as e:
            last_err = e

    raise ValueError(f"Failed to parse SQL: {last_err}")


def _as_list(x: Union[List[str], set[str]]) -> List[str]:
    return list(x) if not isinstance(x, list) else x


def _dedupe_list(xs: List[str]) -> List[str]:
    return list(set(xs))


class ColumnLineageNoConn:
    def __init__(
        self,
        sql: Optional[str] = "",
        dialect: str = "spark",
        input_table_dict: Optional[Dict[str, List[str]]] = None,
    ):
        self.column_dict: Dict[str, Lineage] = {}
        self.table_alias_dict: Dict[str, AliasTarget] = {}
        self.cte_table_dict: Dict[str, List[str]] = {}
        self.cte_dict: Dict[str, Dict[str, Lineage]] = {}
        self.unnest_dict: Dict[str, Lineage] = {}

        self.input_table_dict: Dict[str, List[str]] = input_table_dict or {}
        self.sql_ast: Expression = parse_one_sql(sql=sql, preferred_dialect=dialect)

        self.all_used_col: Union[List[str], set[str]] = []
        self.table_list: List[str] = []
        self.all_subquery_table: List[str] = []
        self.sub_tables: List[str] = []
        self.sub_cols: List[str] = []
        self.no_name_sub_flag: bool = False

        self._run_cte_lineage()

        for with_sql in self.sql_ast.find_all(exp.With):
            with_sql.pop()

        self._sub_shared_col_conds(sql_ast=self.sql_ast)
        self._run_lineage(self.sql_ast, False)

    def _run_lineage(
        self, sql_ast: Optional[Expression] = None, subquery_flag: bool = False
    ) -> None:
        if sql_ast is None:
            return

        if not subquery_flag:
            self.all_used_col = []
            self.no_name_sub_flag = False

            if isinstance(sql_ast, (exp.Union, exp.Except, exp.Intersect)):
                self._handle_union(sql_ast=sql_ast)

            main_tables = self._resolve_table(part_ast=sql_ast)
            self.table_list = self._find_all_tables(temp_table_list=main_tables)
            self.table_list.extend(self.all_subquery_table)
            self.table_list = [
                x for x in self.table_list if x not in list(self.cte_dict.keys())
            ]

            self._shared_col_conds(part_ast=sql_ast, used_tables=main_tables)

            used = _as_list(self.all_used_col)
            used.extend(self.sub_cols)
            self.all_used_col = list(set(used))

            select = sql_ast.find(exp.Select)
            if select is not None:
                self.column_dict = self._resolve_proj_handler(
                    sql_ast=sql_ast,
                    target_dict=self.column_dict,
                    source_table=self._remove_bad_table(sql_ast=sql_ast),
                )

            self.table_list = list(set(self.table_list))

            new_column_dict: Dict[str, Lineage] = {}
            for k, (proj_cols, ref_cols) in self.column_dict.items():
                temp_v: Dict[str, str] = {}
                for i in proj_cols + ref_cols:
                    if "." in i:
                        temp_v[i.split(".")[-1].lower()] = i

                proj_new = proj_cols.copy()
                for i in proj_cols:
                    hit = temp_v.get(i.lower())
                    if hit:
                        proj_new = [x for x in proj_new if x != i]
                        if hit not in proj_cols:
                            proj_new.append(hit)

                ref_new = ref_cols.copy()
                for i in ref_cols:
                    hit = temp_v.get(i.lower())
                    if hit:
                        ref_new = [x for x in ref_new if x != i]
                        if hit not in ref_cols:
                            ref_new.append(hit)

                proj_new = [x for x in proj_new if x != ""]
                ref_new = [x for x in ref_new if x != ""]
                new_column_dict[k] = (proj_new, ref_new)

            self.column_dict = new_column_dict

        else:
            temp_sub_cols: List[str] = []
            for col in sql_ast.find_all(exp.Column):
                proj, ref = self._find_alias_col(
                    col_sql=col.sql(), temp_table=self.sub_tables, ref=True
                )
                temp_sub_cols.extend(proj + ref)
            self.sub_cols.extend(temp_sub_cols)

    def _remove_bad_table(self, sql_ast: Optional[Expression] = None) -> List[str]:
        if sql_ast is None:
            return []
        temp_ast = sql_ast.copy()
        for cond in shared_conditions:
            for cond_sql in temp_ast.find_all(cond):
                cond_sql.pop()
        return self._resolve_table(part_ast=temp_ast)

    def _resolve_proj_handler(
        self,
        sql_ast: Optional[Expression] = None,
        target_dict: Optional[Dict[str, Lineage]] = None,
        source_table: Optional[List[str]] = None,
    ) -> Dict[str, Lineage]:
        if sql_ast is None:
            return target_dict or {}

        select = sql_ast.find(exp.Select)
        if select is None:
            return target_dict or {}

        target_dict = target_dict or {}
        source_table = source_table or []

        n = 0
        for projection in select.expressions:
            col_name = projection.alias_or_name
            if col_name == "":
                col_name = f"unnamed_column_{n}"
                n += 1

            target_dict = self._resolve_proj(
                projection=projection,
                col_name=col_name,
                target_dict=target_dict,
                source_table=source_table,
            )

            used_cols = set(_as_list(self.all_used_col))
            if col_name in used_cols:
                from_source = False

                for t in source_table:
                    resolved = self.table_alias_dict.get(t, t)
                    candidates = resolved if isinstance(resolved, list) else [resolved]

                    for cand in candidates:
                        if (
                            cand in self.input_table_dict
                            and col_name in self.input_table_dict[cand]
                        ):
                            from_source = True
                            break
                        if cand in self.cte_dict and col_name in self.cte_dict[cand]:
                            from_source = True
                            break

                    if from_source:
                        break

                if not from_source:
                    proj_cols, ref_cols = target_dict[col_name]
                    new_col = proj_cols + ref_cols
                    if col_name in new_col:
                        new_col = [x for x in new_col if x != col_name]

                    new_target: Dict[str, Lineage] = {}
                    for k, (pcols, rcols) in target_dict.items():
                        rcols2 = [x for x in rcols if x != col_name]
                        new_target[k] = (pcols, _dedupe_list(rcols2 + new_col))
                    target_dict = new_target

                    used_cols.discard(col_name)
                    used_cols = used_cols.union(set(new_col))
                    self.all_used_col = used_cols

        return target_dict

    def _handle_union(self, sql_ast: Optional[Expression] = None) -> None:
        if sql_ast is None:
            return

        if isinstance(sql_ast, (exp.Union, exp.Except, exp.Intersect)):
            self._handle_union(sql_ast=sql_ast.left)
            self._handle_union(sql_ast=sql_ast.right)
        else:
            main_tables = self._resolve_table(part_ast=sql_ast)
            self._shared_col_conds(part_ast=sql_ast, used_tables=main_tables)
            used = _as_list(self.all_used_col)
            for col in sql_ast.find_all(exp.Column):
                proj, ref = self._find_alias_col(
                    col_sql=col.sql(), temp_table=main_tables, ref=True
                )
                used.extend(proj + ref)
            self.all_used_col = used

    def _sub_shared_col_conds(self, sql_ast: Optional[Expression] = None) -> None:
        if sql_ast is None:
            return

        for cond in shared_conditions_with_table:
            for cond_sql in sql_ast.find_all(cond):
                for sub_ast in cond_sql.find_all(exp.Subquery):
                    self.sub_tables = self._resolve_table(part_ast=sub_ast)
                    self.all_subquery_table.extend(
                        self._find_all_tables(temp_table_list=self.sub_tables)
                    )

                    self._shared_col_conds(
                        part_ast=sub_ast, used_tables=self.sub_tables
                    )

                    if type(sub_ast.parent) in from_join_exp:
                        temp_sub_dict: Dict[str, Lineage] = {}
                        temp_sub_dict = self._resolve_proj_handler(
                            sql_ast=sub_ast,
                            target_dict=temp_sub_dict,
                            source_table=self._remove_bad_table(sql_ast=sub_ast),
                        )

                        alias_node = sub_ast.find(exp.TableAlias)
                        if alias_node is not None:
                            if alias_node.depth - sub_ast.depth > 1:
                                sub_name = "no_name_subquery"
                            else:
                                sub_name = alias_node.alias_or_name
                        else:
                            sub_name = "no_name_subquery"

                        sub_ast.replace(exp.Table(this=sub_name))
                        self.cte_dict[sub_name] = temp_sub_dict

                    self._run_lineage(sub_ast, True)
                    sub_ast.pop()

    def _sub_shared_col_conds_cte(
        self, sql_ast: Optional[Expression] = None
    ) -> Tuple[List[str], List[str], List[str], str]:
        if sql_ast is None:
            return [], [], [], ""

        all_cte_sub_table: List[str] = []
        potential_cte_sub_table: List[str] = []
        all_cte_sub_cols: List[str] = []
        sub_name = ""

        for cond in shared_conditions_with_table:
            for cond_sql in sql_ast.find_all(cond):
                for sub_ast in cond_sql.find_all(exp.Subquery):
                    temp_sub_table = self._resolve_table(part_ast=sub_ast)
                    temp_sub_cols: List[str] = []
                    temp_dict: Dict[str, Lineage] = {}

                    for col in sub_ast.find_all(exp.Column):
                        if col.find(exp.Star):
                            temp_dict = self._resolve_agg_star(
                                col_name="*",
                                projection=col,
                                used_tables=temp_sub_table,
                                target_dict=temp_dict,
                            )
                            for _, (pcols, rcols) in temp_dict.items():
                                temp_sub_cols.extend(pcols)
                                temp_sub_cols.extend(rcols)
                        else:
                            proj, ref = self._find_alias_col(
                                col_sql=col.sql(), temp_table=temp_sub_table, ref=True
                            )
                            temp_sub_cols.extend(proj + ref)

                    temp_sub_cols = list(set(temp_sub_cols))
                    all_cte_sub_table.extend(
                        self._find_all_tables(temp_table_list=temp_sub_table)
                    )
                    all_cte_sub_cols.extend(temp_sub_cols)

                    if len(all_cte_sub_table) == 1:
                        alias_node = sub_ast.find(exp.TableAlias)
                        if alias_node is not None:
                            self.table_alias_dict[alias_node.alias_or_name] = (
                                all_cte_sub_table[0]
                            )

                    potential_cte_sub_table = temp_sub_table

                    if type(sub_ast.parent) in from_join_exp:
                        temp_sub_dict: Dict[str, Lineage] = {}
                        temp_sub_dict = self._resolve_proj_handler(
                            sql_ast=sub_ast,
                            target_dict=temp_sub_dict,
                            source_table=self._remove_bad_table(sql_ast=sub_ast),
                        )
                        alias_node = sub_ast.find(exp.TableAlias)
                        sub_name = (
                            alias_node.alias_or_name
                            if alias_node is not None
                            else "no_name_subquery"
                        )
                        self.cte_dict[sub_name] = temp_sub_dict
                        sub_ast.replace(exp.Table(this=sub_name))

                    sub_ast.pop()

        return all_cte_sub_table, all_cte_sub_cols, potential_cte_sub_table, sub_name

    def _run_cte_lineage(self) -> None:
        for cte in self.sql_ast.find_all(exp.CTE):
            all_cte_sub_table, all_cte_sub_cols, potential_cte_sub_table, sub_name = (
                self._sub_shared_col_conds_cte(sql_ast=cte)
            )

            self.all_used_col = []
            self.no_name_sub_flag = False

            temp_cte_dict: Dict[str, Lineage] = {}
            temp_cte_table = self._resolve_table(part_ast=cte)
            if len(temp_cte_table) == 0:
                temp_cte_table = potential_cte_sub_table

            alias_node = cte.find(exp.TableAlias)
            if alias_node is None:
                continue
            cte_name = alias_node.alias_or_name

            cte_tables = temp_cte_table.copy()
            if sub_name in cte_tables:
                cte_tables.remove(sub_name)

            self.cte_table_dict[cte_name] = list(
                set(
                    self._find_all_tables(temp_table_list=cte_tables)
                    + all_cte_sub_table
                )
            )

            union = cte.find(exp.Union)
            except_ = cte.find(exp.Except)
            intersect = cte.find(exp.Intersect)

            if union is not None and union.depth == cte.depth + 1:
                self._handle_union(sql_ast=union)
            elif except_ is not None and except_.depth == cte.depth + 1:
                self._handle_union(sql_ast=cte.find(exp.Union))
            elif intersect is not None and intersect.depth == cte.depth + 1:
                self._handle_union(sql_ast=cte.find(exp.Union))
            else:
                self._shared_col_conds(part_ast=cte, used_tables=temp_cte_table)
                used = _as_list(self.all_used_col)
                used.extend(all_cte_sub_cols)
                self.all_used_col = set(used)

            self.all_used_col = set(_as_list(self.all_used_col))

            temp_cte_dict = self._resolve_proj_handler(
                sql_ast=cte,
                target_dict=temp_cte_dict,
                source_table=self._remove_bad_table(sql_ast=cte),
            )
            self.cte_dict[cte_name] = temp_cte_dict

    def _resolve_proj(
        self,
        projection: Optional[Expression] = None,
        col_name: str = "",
        target_dict: Optional[Dict[str, Lineage]] = None,
        source_table: Optional[List[str]] = None,
    ) -> Dict[str, Lineage]:
        target_dict = target_dict or {}
        source_table = source_table or []

        if projection is None:
            return target_dict

        if (
            projection.find(exp.Star)
            and not isinstance(projection.unalias(), exp.Array)
            and not isinstance(projection, exp.Array)
        ):
            if isinstance(projection, exp.Count):
                return self._resolve_agg_star(
                    col_name="count",
                    projection=projection,
                    used_tables=source_table,
                    target_dict=target_dict,
                )
            if isinstance(projection, exp.Avg):
                return self._resolve_agg_star(
                    col_name="avg",
                    projection=projection,
                    used_tables=source_table,
                    target_dict=target_dict,
                )
            if isinstance(projection, exp.Max):
                return self._resolve_agg_star(
                    col_name="max",
                    projection=projection,
                    used_tables=source_table,
                    target_dict=target_dict,
                )
            if isinstance(projection, exp.Min):
                return self._resolve_agg_star(
                    col_name="min",
                    projection=projection,
                    used_tables=source_table,
                    target_dict=target_dict,
                )
            if isinstance(projection, exp.Sum):
                return self._resolve_agg_star(
                    col_name="sum",
                    projection=projection,
                    used_tables=source_table,
                    target_dict=target_dict,
                )
            return self._resolve_agg_star(
                col_name=col_name,
                projection=projection.unalias(),
                used_tables=source_table,
                target_dict=target_dict,
            )

        if isinstance(projection.unalias(), exp.Array) or isinstance(
            projection, exp.Array
        ):
            temp_col = [p.sql() for p in projection.find_all(exp.Column)]
            proj_columns: List[str] = []
            ref_temp_col: List[str] = []
            for p in temp_col:
                pcols, rcols = self._find_alias_col(
                    col_sql=p, temp_table=source_table, ref=False
                )
                proj_columns.extend(pcols)
                ref_temp_col.extend(rcols)
            used = set(_as_list(self.all_used_col))
            target_dict[col_name] = (
                _dedupe_list(proj_columns),
                _dedupe_list(list(used) + ref_temp_col),
            )
            return target_dict

        if not isinstance(projection, exp.Column) and projection.find(exp.Star):
            for t_name in source_table:
                resolved = self.table_alias_dict.get(t_name, t_name)
                candidates = resolved if isinstance(resolved, list) else [resolved]
                for cand in candidates:
                    if cand in self.input_table_dict:
                        for per_star_col in self.input_table_dict[cand]:
                            pcols, rcols = self._find_alias_col(
                                col_sql=per_star_col, temp_table=source_table, ref=False
                            )
                            target_dict[per_star_col] = (
                                pcols,
                                _dedupe_list(_as_list(self.all_used_col) + rcols),
                            )
                    elif cand in self.cte_dict:
                        for per_star_col, (pcols, rcols) in self.cte_dict[cand].items():
                            target_dict[per_star_col] = (
                                _dedupe_list(pcols),
                                _dedupe_list(_as_list(self.all_used_col) + rcols),
                            )

        proj_columns: List[str] = []
        ref_proj_cols: List[str] = []

        for p in projection.find_all(exp.Column):
            if isinstance(p, exp.Column) and p.find(exp.Star):
                ident = p.find(exp.Identifier)
                if ident is None:
                    continue
                t_name = ident.text("this")

                resolved = self.table_alias_dict.get(t_name, t_name)
                candidates = resolved if isinstance(resolved, list) else [resolved]

                for cand in candidates:
                    if cand in self.input_table_dict:
                        for per_star_col in self.input_table_dict[cand]:
                            pcols, rcols = self._find_alias_col(
                                col_sql=per_star_col, temp_table=source_table, ref=False
                            )
                            target_dict[per_star_col] = (
                                pcols,
                                _dedupe_list(_as_list(self.all_used_col) + rcols),
                            )
                    elif cand in self.cte_dict:
                        for per_star_col, (pcols, rcols) in self.cte_dict[cand].items():
                            target_dict[per_star_col] = (
                                _dedupe_list(pcols),
                                _dedupe_list(_as_list(self.all_used_col) + rcols),
                            )
                    else:
                        target_dict[p.sql()] = ([p.sql()], _as_list(self.all_used_col))
            else:
                pcols, rcols = self._find_alias_col(
                    col_sql=p.sql(), temp_table=source_table, ref=False
                )
                proj_columns.extend(pcols)
                ref_proj_cols.extend(rcols)

        if proj_columns:
            used = set(_as_list(self.all_used_col))
            target_dict[col_name] = (
                _dedupe_list(proj_columns),
                _dedupe_list(list(used) + ref_proj_cols),
            )

        if not projection.find(exp.Column):
            target_dict[col_name] = ([""], _as_list(self.all_used_col))

        return target_dict

    def _resolve_table(self, part_ast: Optional[Expression] = None) -> List[str]:
        if part_ast is None:
            return []

        temp_table_list: List[str] = []
        for cond in from_join_exp:
            for table_sql in part_ast.find_all(cond):
                if table_sql.find(exp.GenerateSeries):
                    gs = table_sql.find(exp.GenerateSeries)
                    if gs is not None and gs.depth <= table_sql.depth + 2:
                        continue

                elif table_sql.find(exp.Unnest):
                    temp_col_name: List[str] = []
                    dep_tables: List[str] = []

                    for t in table_sql.find_all(exp.Identifier):
                        temp_col_name.append(t.text("this"))

                        if len(temp_col_name) == 2:
                            pcols, rcols = self._find_alias_col(
                                col_sql=f"{temp_col_name[1]}.{temp_col_name[0]}",
                                temp_table=[temp_col_name[1]],
                                ref=True,
                            )
                            used = _as_list(self.all_used_col)
                            used.extend(pcols + rcols)
                            self.all_used_col = used

                            dep_cols = list(set(pcols + rcols))
                            for x in dep_cols:
                                if x.count(".") >= 2:
                                    dep_tables.append(x[: x.rfind(".")])
                                elif x.count(".") == 1:
                                    dep_tables.append(x.split(".")[0])

                            dep_tables = list(set(dep_tables))
                            self.table_alias_dict[temp_col_name[0]] = dep_tables
                            self.unnest_dict[temp_col_name[0]] = (dep_cols, [])

                            alias_node = table_sql.find(exp.TableAlias)
                            if alias_node is not None:
                                alias_name = alias_node.text("this")
                                self.table_alias_dict[alias_name] = dep_tables
                                self.unnest_dict[alias_name] = (dep_cols, [])

                    temp_table_list.extend(dep_tables)

                for table in table_sql.find_all(exp.Table):
                    if table.name == "no_name_subquery":
                        self.no_name_sub_flag = True
                        continue
                    temp_table_list = self._find_table(
                        table=table, temp_table_list=temp_table_list
                    )

        return temp_table_list

    def _find_table(
        self,
        table: Optional[Expression] = None,
        temp_table_list: Optional[List[str]] = None,
    ) -> List[str]:
        temp_table_list = temp_table_list or []
        if table is None:
            return temp_table_list

        raw = table.sql()
        parts = raw.split()
        if not parts:
            return temp_table_list

        base = parts[0]
        alias = ""

        if len(parts) >= 3 and parts[1].lower() == "as":
            alias = parts[2]
        elif len(parts) >= 2:
            alias = parts[1]

        if alias:
            self.table_alias_dict[alias] = base
            temp_table_list.append(base)
        else:
            self.table_alias_dict[raw] = raw
            temp_table_list.append(raw)

        return temp_table_list

    def _find_all_tables(
        self, temp_table_list: Optional[List[str]] = None
    ) -> List[str]:
        temp_table_list = temp_table_list or []
        ret_table: List[str] = []

        for i in temp_table_list:
            resolved = self.table_alias_dict.get(i, i)
            candidates = resolved if isinstance(resolved, list) else [resolved]

            for table_name in candidates:
                if table_name in self.cte_table_dict:
                    ret_table.extend(self.cte_table_dict[table_name])
                else:
                    ret_table.append(table_name)

        return ret_table

    def _shared_col_conds(
        self,
        part_ast: Optional[Expression] = None,
        used_tables: Optional[List[str]] = None,
    ) -> None:
        if part_ast is None:
            return

        used_tables = used_tables or []
        temp_ast = part_ast.copy()

        for case_ast in temp_ast.find_all(exp.Case):
            if type(case_ast.parent) not in [
                exp.Where,
                exp.Group,
                exp.Having,
                exp.Order,
            ]:
                case_ast.pop()

        for cond in shared_conditions:
            for cond_sql in temp_ast.find_all(cond):
                if cond_sql.find(exp.Select):
                    select_ast = cond_sql.find(exp.Select)
                    if select_ast is not None:
                        select_ast = select_ast.pop()
                        select_table = self._resolve_table(part_ast=select_ast)

                        self._shared_col_conds(
                            part_ast=select_ast, used_tables=select_table
                        )

                        dummy_dict: Dict[str, Lineage] = {}
                        dummy_dict = self._resolve_proj_handler(
                            sql_ast=select_ast,
                            target_dict=dummy_dict,
                            source_table=select_table,
                        )

                        temp_c: List[str] = []
                        for _, (pcols, rcols) in dummy_dict.items():
                            temp_c.extend(pcols + rcols)

                        used = _as_list(self.all_used_col)
                        used.extend(list(set(temp_c)))
                        self.all_used_col = used

                        used_tables = self._find_all_tables(
                            temp_table_list=self._resolve_table(part_ast=temp_ast)
                        )

                for cond_col in cond_sql.find_all(exp.Column):
                    pcols, rcols = self._find_alias_col(
                        col_sql=cond_col.sql(), temp_table=used_tables, ref=True
                    )
                    used = _as_list(self.all_used_col)
                    used.extend(pcols + rcols)
                    self.all_used_col = used

    def _find_alias_col(
        self,
        col_sql: str = "",
        temp_table: Optional[List[str]] = None,
        ref: bool = False,
    ) -> Lineage:
        temp_table = temp_table or []
        temp = col_sql.split(".")

        if col_sql in self.unnest_dict:
            return self.unnest_dict[col_sql]

        elim_table: List[str] = []

        if len(temp) < 2:
            for t in temp_table:
                resolved = self.table_alias_dict.get(t, t)
                candidates = resolved if isinstance(resolved, list) else [resolved]

                for cand in candidates:
                    if cand in self.input_table_dict:
                        if col_sql.lower() in [
                            x.lower() for x in self.input_table_dict[cand]
                        ]:
                            return (
                                ([], [f"{cand}.{col_sql}"])
                                if ref
                                else ([f"{cand}.{col_sql}"], [])
                            )
                        elim_table.append(cand)
                    elif cand in self.cte_dict:
                        if col_sql in self.cte_dict[cand]:
                            return self.cte_dict[cand][col_sql]
                        temp_cte_dict = {
                            k.lower(): v for k, v in self.cte_dict[cand].items()
                        }
                        if col_sql.lower() in temp_cte_dict:
                            return temp_cte_dict[col_sql.lower()]
                        elim_table.append(cand)

            deduced_table = set(temp_table) - set(elim_table)
            if len(deduced_table) == 1:
                tname = next(iter(deduced_table))
                resolved = self.table_alias_dict.get(tname, tname)
                candidates = resolved if isinstance(resolved, list) else [resolved]
                if len(candidates) == 1:
                    base = candidates[0]
                    return (
                        ([], [f"{base}.{col_sql}"])
                        if ref
                        else ([f"{base}.{col_sql}"], [])
                    )

        if len(temp) == 2:
            t = self.table_alias_dict.get(temp[0], temp[0])

            if isinstance(t, list):
                vals = [f"{x}.{temp[1]}" for x in t]
                return ([], vals) if ref else (vals, [])

            if t in self.cte_dict:
                if temp[1] not in self.cte_dict[t]:
                    temp_cte_dict = {k.lower(): v for k, v in self.cte_dict[t].items()}
                    if temp[1].lower() in temp_cte_dict:
                        return temp_cte_dict[temp[1].lower()]
                return self.cte_dict[t].get(
                    temp[1],
                    ([], [f"{t}.{temp[1]}"]) if ref else ([f"{t}.{temp[1]}"], []),
                )

            return ([], [f"{t}.{temp[1]}"]) if ref else ([f"{t}.{temp[1]}"], [])

        return ([], [col_sql]) if ref else ([col_sql], [])

    def _resolve_agg_star(
        self,
        col_name: str = "",
        projection: Optional[Expression] = None,
        used_tables: Optional[List[str]] = None,
        target_dict: Optional[Dict[str, Lineage]] = None,
    ) -> Dict[str, Lineage]:
        target_dict = target_dict or {}
        used_tables = used_tables or []

        if projection is None or not projection.find(exp.Star):
            return target_dict

        ident = projection.find(exp.Identifier)
        if ident is not None or (
            self.no_name_sub_flag and "no_name_subquery" in self.cte_dict
        ):
            t_name = (
                "no_name_subquery"
                if (self.no_name_sub_flag and "no_name_subquery" in self.cte_dict)
                else ident.text("this")  # type: ignore
            )

            resolved = self.table_alias_dict.get(t_name, t_name)
            candidates = resolved if isinstance(resolved, list) else [resolved]

            if col_name == "*":
                for cand in candidates:
                    if cand in self.input_table_dict:
                        for s in self.input_table_dict[cand]:
                            pcols, rcols = self._find_alias_col(
                                col_sql=f"{cand}.{s}", temp_table=used_tables, ref=False
                            )
                            target_dict[s] = (
                                pcols,
                                _dedupe_list(_as_list(self.all_used_col) + rcols),
                            )
                    elif cand in self.cte_dict:
                        for s, (pcols, rcols) in self.cte_dict[cand].items():
                            target_dict[s] = (
                                _dedupe_list(pcols),
                                _dedupe_list(_as_list(self.all_used_col) + rcols),
                            )
                    else:
                        target_dict[f"{cand}.*"] = (
                            [f"{cand}.*"],
                            _as_list(self.all_used_col),
                        )
            else:
                star_cols: List[str] = []
                ref_star_cols: List[str] = []

                for cand in candidates:
                    if cand in self.input_table_dict:
                        for s in self.input_table_dict[cand]:
                            pcols, rcols = self._find_alias_col(
                                col_sql=s, temp_table=used_tables, ref=False
                            )
                            star_cols.extend(pcols)
                            ref_star_cols.extend(rcols)
                    elif cand in self.cte_dict:
                        for _, (pcols, rcols) in self.cte_dict[cand].items():
                            star_cols.extend(pcols)
                            ref_star_cols.extend(rcols)
                    else:
                        star_cols.append(f"{cand}.*")

                target_dict[col_name] = (
                    _dedupe_list(star_cols),
                    _dedupe_list(_as_list(self.all_used_col) + ref_star_cols),
                )

        else:
            if (
                isinstance(projection.parent, exp.Select)
                and projection.parent.depth + 1 == projection.depth
                and not isinstance(
                    projection, (exp.Count, exp.Min, exp.Max, exp.Sum, exp.Avg)
                )
            ):
                for t_name in used_tables:
                    resolved = self.table_alias_dict.get(t_name, t_name)
                    candidates = resolved if isinstance(resolved, list) else [resolved]

                    for cand in candidates:
                        if cand in self.input_table_dict:
                            for s in self.input_table_dict[cand]:
                                pcols, rcols = self._find_alias_col(
                                    col_sql=f"{cand}.{s}",
                                    temp_table=used_tables,
                                    ref=False,
                                )
                                target_dict[s] = (
                                    pcols,
                                    _dedupe_list(_as_list(self.all_used_col) + rcols),
                                )
                        elif cand in self.cte_dict:
                            for s, (pcols, rcols) in self.cte_dict[cand].items():
                                target_dict[s] = (
                                    _dedupe_list(pcols),
                                    _dedupe_list(_as_list(self.all_used_col) + rcols),
                                )
                        else:
                            target_dict[f"{cand}.*"] = (
                                [f"{cand}.*"],
                                _as_list(self.all_used_col),
                            )
            else:
                for t_name in used_tables:
                    resolved = self.table_alias_dict.get(t_name, t_name)
                    candidates = resolved if isinstance(resolved, list) else [resolved]

                    temp_col: List[str] = []
                    for cand in candidates:
                        if cand in self.input_table_dict:
                            for s in self.input_table_dict[cand]:
                                pcols, rcols = self._find_alias_col(
                                    col_sql=f"{cand}.{s}",
                                    temp_table=used_tables,
                                    ref=True,
                                )
                                temp_col.extend(pcols + rcols)
                            target_dict[col_name] = (
                                [""],
                                _dedupe_list(
                                    list(
                                        set(_as_list(self.all_used_col)).union(
                                            set(temp_col)
                                        )
                                    )
                                ),
                            )
                        elif cand in self.cte_dict:
                            for s in self.cte_dict[cand]:
                                pcols, rcols = self._find_alias_col(
                                    col_sql=f"{cand}.{s}",
                                    temp_table=used_tables,
                                    ref=True,
                                )
                                temp_col.extend(pcols + rcols)
                            target_dict[col_name] = (
                                [""],
                                _dedupe_list(
                                    list(
                                        set(_as_list(self.all_used_col)).union(
                                            set(temp_col)
                                        )
                                    )
                                ),
                            )
                        else:
                            target_dict[col_name] = (
                                [""],
                                _as_list(self.all_used_col) + [f"{cand}.*"],
                            )

        return target_dict


if __name__ == "__main__":
    pass
