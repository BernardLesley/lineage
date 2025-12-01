from app.routes.dashboard_routes import router as dashboard_metadata_router
from app.routes.lineage_routes import router as lineage_router
from app.routes.sql_routes import router as sql_router
from app.routes.table_routes import router as table_metadata_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Data Lineage & Monitoring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lineage_router)
app.include_router(table_metadata_router)
app.include_router(dashboard_metadata_router)
app.include_router(sql_router)
