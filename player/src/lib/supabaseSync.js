import "server-only";

function isTruthy(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isFalsey(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off";
}

function readConfig() {
  const baseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const schema = String(process.env.SUPABASE_SCHEMA || "public").trim() || "public";
  const enabled = baseUrl !== "" && serviceRoleKey !== "" && !isTruthy(process.env.SUPABASE_SYNC_DISABLED);
  const primary = enabled && !isFalsey(process.env.SUPABASE_PRIMARY ?? "true");

  return { baseUrl, serviceRoleKey, schema, enabled, primary };
}

function getConfig() {
  if (!globalThis.__supabaseSyncConfig) {
    globalThis.__supabaseSyncConfig = readConfig();
  }
  return globalThis.__supabaseSyncConfig;
}

function buildHeaders(extraHeaders = {}) {
  const { serviceRoleKey, schema } = getConfig();
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (schema !== "public") {
    headers["Accept-Profile"] = schema;
    headers["Content-Profile"] = schema;
  }
  return headers;
}

function buildTableUrl(tableName, filters = [], query = {}) {
  const { baseUrl } = getConfig();
  const url = new URL(`/rest/v1/${tableName}`, baseUrl);
  for (const filter of filters) {
    if (!filter || typeof filter.column !== "string" || !filter.column.trim()) continue;
    const column = filter.column.trim();
    const operator = String(filter.operator || "eq").trim();

    if (filter.value === null || filter.value === undefined) {
      if (operator === "eq" || operator === "is") {
        url.searchParams.append(column, "is.null");
      } else {
        url.searchParams.append(column, `${operator}.null`);
      }
      continue;
    }

    url.searchParams.append(column, `${operator}.${String(filter.value)}`);
  }
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.append(key, String(value));
  }
  return url.toString();
}

async function callSupabase(method, tableName, { body, filters = [], headers = {}, query = {}, parseJson = false } = {}) {
  const config = getConfig();
  if (!config.enabled) {
    return parseJson ? [] : undefined;
  }

  const response = await fetch(buildTableUrl(tableName, filters, query), {
    method,
    headers: buildHeaders(headers),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase ${method} ${tableName} failed: ${response.status} ${text}`);
  }

  if (!parseJson) return;
  if (response.status === 204) return [];
  return response.json();
}

export function isSupabaseSyncEnabled() {
  return getConfig().enabled;
}

export function isSupabasePrimaryEnabled() {
  return getConfig().primary;
}

export function enqueueSupabaseSync(taskName, taskFn) {
  if (!isSupabaseSyncEnabled()) return;
  if (isSupabasePrimaryEnabled()) return;
  Promise.resolve()
    .then(taskFn)
    .catch((error) => {
      console.error(`[supabase-sync] ${taskName} failed:`, error);
    });
}

export async function insertRows(tableName, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const result = await callSupabase("POST", tableName, {
    body: rows,
    headers: {
      Prefer: "return=representation",
    },
    parseJson: true,
  });
  return Array.isArray(result) ? result : [];
}

export async function upsertRows(tableName, rows, onConflictColumns) {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const filters = [];
  const headers = {
    Prefer: "resolution=merge-duplicates,return=minimal",
  };

  if (Array.isArray(onConflictColumns) && onConflictColumns.length > 0) {
    const url = new URL(buildTableUrl(tableName));
    url.searchParams.set("on_conflict", onConflictColumns.join(","));
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: buildHeaders(headers),
      body: JSON.stringify(rows),
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Supabase upsert ${tableName} failed: ${response.status} ${text}`);
    }
    return;
  }

  await callSupabase("POST", tableName, {
    body: rows,
    filters,
    headers,
  });
}

export async function deleteRows(tableName, filters) {
  await callSupabase("DELETE", tableName, {
    filters: Array.isArray(filters) ? filters : [],
    headers: {
      Prefer: "return=minimal",
    },
  });
}

export async function patchRows(tableName, values, filters) {
  await callSupabase("PATCH", tableName, {
    body: values,
    filters: Array.isArray(filters) ? filters : [],
    headers: {
      Prefer: "return=minimal",
    },
  });
}

export async function fetchRows(
  tableName,
  {
    filters = [],
    select = "*",
    orderBy = [],
    limit,
    offset,
    single = false,
  } = {},
) {
  const orders = Array.isArray(orderBy) ? orderBy : [];
  const query = {
    select,
  };
  if (orders.length > 0) {
    query.order = orders.join(",");
  }
  if (typeof limit === "number" && Number.isFinite(limit)) {
    query.limit = Math.max(0, Math.trunc(limit));
  }
  if (typeof offset === "number" && Number.isFinite(offset)) {
    query.offset = Math.max(0, Math.trunc(offset));
  }

  const rows = await callSupabase("GET", tableName, {
    filters: Array.isArray(filters) ? filters : [],
    query,
    parseJson: true,
  });
  const list = Array.isArray(rows) ? rows : [];
  if (single) {
    return list[0] ?? null;
  }
  return list;
}

export async function fetchAllRows(
  tableName,
  {
    filters = [],
    select = "*",
    orderBy = [],
    batchSize = 1000,
  } = {},
) {
  const normalizedBatchSize = Math.max(1, Math.trunc(Number(batchSize) || 1000));
  let offset = 0;
  const allRows = [];

  while (true) {
    const rows = await fetchRows(tableName, {
      filters,
      select,
      orderBy,
      limit: normalizedBatchSize,
      offset,
    });
    if (!rows.length) break;
    allRows.push(...rows);
    if (rows.length < normalizedBatchSize) break;
    offset += rows.length;
  }

  return allRows;
}

export async function getNextTableId(tableName) {
  const lastRow = await fetchRows(tableName, {
    select: "id",
    orderBy: ["id.desc"],
    limit: 1,
    single: true,
  });
  const lastId = Number(lastRow?.id ?? 0);
  if (!Number.isFinite(lastId) || lastId < 0) return 1;
  return Math.trunc(lastId) + 1;
}

export async function fetchRowsCount(tableName, filters = []) {
  const config = getConfig();
  if (!config.enabled) return 0;

  const url = new URL(buildTableUrl(tableName, filters));
  url.searchParams.set("select", "id");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    method: "HEAD",
    headers: buildHeaders({
      Prefer: "count=exact",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase count ${tableName} failed: ${response.status} ${text}`);
  }

  const contentRange = response.headers.get("content-range");
  if (!contentRange) return 0;
  const parts = contentRange.split("/");
  if (parts.length !== 2) return 0;
  const total = Number(parts[1]);
  return Number.isFinite(total) ? total : 0;
}
