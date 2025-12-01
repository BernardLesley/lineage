from app.schemas.sql_generation import SQLTextResponse


def generate_monitor_task_sql() -> SQLTextResponse:
    sql = """
-- Monitor Task SQL (sample)
SELECT
  date,
  COUNT(*) AS row_count
FROM test
GROUP BY date
ORDER BY date;
""".strip()
    return SQLTextResponse(sql=sql)


def generate_mlops_sql() -> SQLTextResponse:
    sql = """
-- MLOps SQL (sample)
SELECT
  prediction_date,
  COUNT(*) AS total_predictions,
  AVG(score) AS avg_score
FROM test
GROUP BY prediction_date
ORDER BY prediction_date;
""".strip()
    return SQLTextResponse(sql=sql)
