import { RawLineage } from "../types";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

const apiUrl = (path: string) =>
  API_BASE_URL ? `${API_BASE_URL}${path}` : path;

export async function getLineage(): Promise<RawLineage> {
  const res = await fetch(apiUrl("/api/v1/lineage/output"));
  if (!res.ok) {
    throw new Error(`Failed to fetch lineage: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function uploadZip(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(apiUrl("/api/v1/lineage/upload-zip"), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload ZIP: ${res.status} ${res.statusText}`);
  }
}

export async function fetchLineageWithFallback(): Promise<RawLineage> {
  try {
    return await getLineage();
  } catch (apiError) {
    try {
      // FIX: fallback should match your built/static filename (recommended: output.json)
      const res = await fetch("/output.json");
      if (!res.ok) {
        throw new Error(
          `Failed to fetch fallback output.json: ${res.status} ${res.statusText}`
        );
      }
      return res.json();
    } catch (fallbackError) {
      throw new Error(
        `Failed to fetch lineage from API and fallback: ${
          (apiError as Error).message
        } | ${(fallbackError as Error).message}`
      );
    }
  }
}

export async function uploadLogs(logs: string): Promise<void> {
  const logsB64 = btoa(unescape(encodeURIComponent(logs)));

  const res = await fetch(apiUrl("/api/v1/lineage/logs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logs_b64: logsB64 }),
  });

  if (!res.ok) {
    throw new Error(`Failed to upload logs: ${res.status} ${res.statusText}`);
  }
}

export type ColumnMetaDto = {
  name: string;
  type: string;
};

export type TableMetaDto = {
  name: string;
  columns: ColumnMetaDto[];
};

export type DashboardMetaDto = {
  name: string;
  description?: string;
  tables: string[];
};

export async function getTableMetadata(): Promise<TableMetaDto[]> {
  const res = await fetch(apiUrl("/api/v1/metadata/tables"));
  if (!res.ok) {
    throw new Error(
      `Failed to fetch table metadata: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function upsertTableMetadata(
  table: TableMetaDto
): Promise<TableMetaDto> {
  const res = await fetch(apiUrl(`/api/v1/metadata/tables`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(table),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to save table metadata: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function deleteTableMetadata(name: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/metadata/tables/${encodeURIComponent(name)}`),
    { method: "DELETE" }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to delete table metadata: ${res.status} ${res.statusText}`
    );
  }
}

export async function getDashboardMetadata(): Promise<DashboardMetaDto[]> {
  const res = await fetch(apiUrl("/api/v1/metadata/dashboards"));
  if (!res.ok) {
    throw new Error(
      `Failed to fetch dashboard metadata: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function upsertDashboardMetadata(
  dashboard: DashboardMetaDto
): Promise<DashboardMetaDto> {
  const res = await fetch(apiUrl(`/api/v1/metadata/dashboards`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dashboard),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to save dashboard metadata: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function deleteDashboardMetadata(name: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/v1/metadata/dashboards/${encodeURIComponent(name)}`),
    { method: "DELETE" }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to delete dashboard metadata: ${res.status} ${res.statusText}`
    );
  }
}

export type SqlTextResponse = {
  sql: string;
};

export async function getMonitorTaskSql(): Promise<string> {
  const res = await fetch(apiUrl("/api/v1/sql/monitor-task"));
  if (!res.ok) {
    throw new Error(
      `Failed to fetch monitor task SQL: ${res.status} ${res.statusText}`
    );
  }
  const data: SqlTextResponse = await res.json();
  return data.sql;
}

export async function getMlopsSql(): Promise<string> {
  const res = await fetch(apiUrl("/api/v1/sql/mlops"));
  if (!res.ok) {
    throw new Error(
      `Failed to fetch MLOps SQL: ${res.status} ${res.statusText}`
    );
  }
  const data: SqlTextResponse = await res.json();
  return data.sql;
}
