from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Union

from .utils import remove_comments_basic


@dataclass
class SqlToDict:
    path: Union[List[str], str]
    dialect: str = "spark"

    sql_files_dict: Dict[str, str] = {}
    org_sql_files_dict: Dict[str, str] = {}

    def __post_init__(self) -> None:
        self.sql_files_dict = {}
        self.org_sql_files_dict = {}
        self._load()

    def _load(self) -> None:
        if isinstance(self.path, list):
            for idx, sql in enumerate(self.path):
                key = str(idx)
                self._add(key, sql)
            return

        p = Path(self.path)
        if p.is_file():
            self._add(p.stem, p.read_text(encoding="utf-8", errors="replace"))
            return

        if p.is_dir():
            for fp in self._walk_sql_files(p):
                key = fp.stem
                self._add(key, fp.read_text(encoding="utf-8", errors="replace"))
            return

        raise FileNotFoundError(f"SQL path not found: {self.path}")

    def _add(self, key: str, sql: str) -> None:
        cleaned = remove_comments_basic(sql)
        self.sql_files_dict[key] = cleaned
        self.org_sql_files_dict[key] = sql

    def _walk_sql_files(self, root: Path) -> List[Path]:
        out: List[Path] = []
        for dirpath, _, filenames in os.walk(root):
            for name in filenames:
                if name.lower().endswith(".sql"):
                    out.append(Path(dirpath) / name)
        return out
