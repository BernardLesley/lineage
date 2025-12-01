from pydantic import BaseModel


class SQLTextResponse(BaseModel):
    sql: str
