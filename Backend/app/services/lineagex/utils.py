import re
from typing import Optional


def remove_comments_basic(sql: Optional[str] = "") -> str:
    if not sql:
        return ""
    q = re.sub(r"/\*[^*]*\*+(?:[^*/][^*]*\*+)*/", "", sql)
    lines = [line for line in q.splitlines() if not re.match(r"^\s*(--|#)", line)]
    q = " ".join([re.split(r"--|#", line)[0] for line in lines])
    q = re.sub(r"\s*,\s*", ",", q)
    q = re.sub(r"\s\s+", " ", q)
    return q.replace("\n", " ").strip()
