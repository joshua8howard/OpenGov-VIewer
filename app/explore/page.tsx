"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/site-header";
import type { Connector, ConnectorOperation } from "@/lib/types";

type UnknownRow = Record<string, unknown>;

type Pagination = {
  count?: number;
  page?: number;
  pages?: number;
  per_page?: number;
  offset?: number;
  limit?: number;
  next?: string | null;
  previous?: string | null;
  requested?: Record<string, unknown>;
};

function flatten(value: unknown, prefix = ""): UnknownRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? { [prefix]: value } : {};
  }
  const result: UnknownRow = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      Object.assign(result, flatten(item, name));
    } else if (Array.isArray(item)) {
      result[name] = item.length;
    } else {
      result[name] = item;
    }
  }
  return result;
}

function findRows(normalized: unknown, raw: unknown): UnknownRow[] {
  const normalizedObject = normalized as Record<string, unknown> | null;
  const data = normalizedObject?.data;
  const candidates = [
    data,
    (raw as Record<string, unknown>)?.results,
    (raw as Record<string, unknown>)?.bills,
    (raw as Record<string, unknown>)?.candidates,
    (raw as Record<string, unknown>)?.committees,
  ];
  const list = candidates.find(Array.isArray);
  if (Array.isArray(list)) return list.map((row) => flatten(row));
  if (data && typeof data === "object") return [flatten(data)];
  if (raw && typeof raw === "object") {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(value)) return value.map((row) => flatten(row));
    }
  }
  return raw ? [flatten(raw)] : [];
}

function placeholders(path: string) {
  return Array.from(path.matchAll(/\{([^}]+)\}/g), (match) => match[1]);
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ExplorePage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectorId, setConnectorId] = useState("");
  const [operations, setOperations] = useState<ConnectorOperation[]>([]);
  const [operation, setOperation] = useState("");
  const [pathParameters, setPathParameters] = useState<Record<string, string>>({});
  const [queryJson, setQueryJson] = useState("{}");
  const [apiKey, setApiKey] = useState("");
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [rows, setRows] = useState<UnknownRow[]>([]);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [view, setView] = useState<"table" | "chart" | "json">("table");
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    fetch("/api/connectors", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load connectors.");
        return response.json() as Promise<Connector[]>;
      })
      .then((items) => {
        setConnectors(items);
        if (items.length) setConnectorId(items[0].id);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load connectors."));
  }, []);

  useEffect(() => {
    if (!connectorId) return;
    setOperations([]);
    setOperation("");
    setRows([]);
    setRaw(null);
    setPagination(null);
    setPage(1);
    setOffset(0);
    setError("");
    fetch(`/api/connectors/${encodeURIComponent(connectorId)}/operations`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load connector operations.");
        return response.json() as Promise<{ operations: ConnectorOperation[] }>;
      })
      .then((payload) => setOperations(payload.operations ?? []))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load operations."));
  }, [connectorId]);

  useEffect(() => {
    setPathParameters({});
    setPagination(null);
    setPage(1);
    setOffset(0);
  }, [operation]);

  const selectedOperation = operations.find((item) =>
    item.name === operation || item.path === operation
  );
  const selectedPath = selectedOperation?.path ?? "";
  const requiredParameters = useMemo(() => placeholders(selectedPath), [selectedPath]);
  const columns = useMemo(() => {
    const names: string[] = [];
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (!names.includes(key)) names.push(key);
      }
    }
    return names.slice(0, 30);
  }, [rows]);

  const numericColumns = useMemo(
    () => columns.filter((column) => rows.some((row) => typeof row[column] === "number")),
    [columns, rows],
  );
  const chartColumn = numericColumns[0];
  const chartRows = chartColumn
    ? rows.filter((row) => typeof row[chartColumn] === "number").slice(0, 12)
    : [];
  const chartMax = chartRows.length
    ? Math.max(...chartRows.map((row) => Number(row[chartColumn])))
    : 0;

  async function execute(targetPage = page, targetOffset = offset) {
    setRunning(true);
    setError("");
    try {
      let query: Record<string, unknown>;
      try {
        query = JSON.parse(queryJson);
        if (!query || Array.isArray(query) || typeof query !== "object") throw new Error();
      } catch {
        throw new Error("Additional parameters must be a JSON object.");
      }
      const parameters: Record<string, unknown> = { ...query, ...pathParameters };
      if (connectorId === "fec") {
        delete parameters.offset;
        delete parameters.limit;
        parameters.page = targetPage;
        parameters.per_page = pageSize;
      } else if (connectorId === "congress-gov") {
        delete parameters.page;
        delete parameters.per_page;
        parameters.limit = pageSize;
        parameters.offset = targetOffset;
        delete parameters.format;
      }
      const response = await fetch(`/api/connectors/${encodeURIComponent(connectorId)}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: selectedOperation?.path ? selectedOperation.path : operation,
          parameters,
          api_key: apiKey || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || "Execution failed.");
      setRaw(payload.response);
      setRows(findRows(payload.normalized, payload.response));
      const nextPagination = payload.normalized?.pagination as Pagination | null;
      setPagination(nextPagination);
      setPage(targetPage);
      setOffset(targetOffset);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Execution failed.");
      setRaw(null);
      setRows([]);
    } finally {
      setRunning(false);
    }
  }

  function downloadCsv() {
    if (!rows.length) return;
    const escape = (value: unknown) => `"${displayValue(value).replaceAll('"', '""')}"`;
    const csv = [
      columns.map(escape).join(","),
      ...rows.map((row) => columns.map((column) => escape(row[column])).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${connectorId}-${operation || "data"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen">
      <SiteHeader active="explore" />
      <div className="explore-shell">
        <div className="explore-heading">
          <div>
            <div className="eyebrow">Connector workspace</div>
            <h1>Data explorer</h1>
          </div>
          {lastUpdated && <div className="updated-note">Updated {lastUpdated}</div>}
        </div>

        <div className="explorer-layout">
          <aside className="explorer-config panel">
            <div className="panel-header">Query builder</div>
            <div className="explorer-form">
              <label className="field-label">
                <span>Connector</span>
                <select value={connectorId} onChange={(event) => setConnectorId(event.target.value)}>
                  {connectors.map((connector) => (
                    <option key={connector.id} value={connector.id}>{connector.name}</option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                <span>Endpoint</span>
                <select value={operation} onChange={(event) => setOperation(event.target.value)}>
                  <option value="">Select an operation</option>
                  {operations.map((item) => (
                    <option key={`${item.path}-${item.name}`} value={item.path}>
                      {item.path}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPath && (
                <div className="endpoint-preview">
                  <small>Resolved endpoint</small>
                  <code>{selectedPath}</code>
                </div>
              )}

              {requiredParameters.map((name) => (
                <label className="field-label" key={name}>
                  <span>{name} <em>required</em></span>
                  <input
                    value={pathParameters[name] ?? ""}
                    onChange={(event) => setPathParameters((current) => ({ ...current, [name]: event.target.value }))}
                    placeholder={`Enter ${name}`}
                  />
                </label>
              ))}

              <label className="field-label">
                <span>Additional parameters</span>
                <textarea
                  value={queryJson}
                  onChange={(event) => setQueryJson(event.target.value)}
                  className="query-json"
                  spellCheck={false}
                  placeholder={'{"limit":100,"year":2026}'}
                />
              </label>

              <label className="field-label">
                <span>Page size</span>
                <select value={pageSize} onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                  setOffset(0);
                }}>
                  {[20, 50, 100].map((size) => (
                    <option key={size} value={size}>{size} rows</option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                <span>API key <em>optional</em></span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Uses server environment key if blank"
                />
              </label>

              <button
                className="primary-button"
                disabled={running || !selectedOperation || requiredParameters.some((name) => !pathParameters[name]?.trim())}
                onClick={() => execute()}
              >
                {running ? "Running query…" : "Run query"}
              </button>
            </div>
          </aside>

          <section className="explorer-content">
            {error && <div className="error-state explorer-error">{error}</div>}

            <div className="stat-grid explorer-stats">
              <div className="stat-card"><span>Rows</span><strong>{rows.length}</strong></div>
              <div className="stat-card"><span>Columns</span><strong>{columns.length}</strong></div>
              <div className="stat-card"><span>Connector</span><strong className="stat-text">{connectors.find((item) => item.id === connectorId)?.name ?? "—"}</strong></div>
              <div className="stat-card"><span>Endpoint</span><strong className="stat-text">{selectedOperation ? "Loaded" : "Waiting"}</strong></div>
            </div>

            <div className="panel explorer-results">
              <div className="panel-header explorer-toolbar">
                <div className="view-tabs">
                  <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>Table</button>
                  <button className={view === "chart" ? "active" : ""} onClick={() => setView("chart")}>Chart</button>
                  <button className={view === "json" ? "active" : ""} onClick={() => setView("json")}>Raw JSON</button>
                </div>
                <button className="secondary-button" disabled={!rows.length} onClick={downloadCsv}>Download CSV</button>
              </div>

              {!raw ? (
                <div className="panel-empty explorer-empty">Choose a connector and operation, then run the query.</div>
              ) : view === "table" ? (
                rows.length ? (
                  <div className="table-scroll">
                    <table className="preview-table explorer-table">
                      <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={index}>{columns.map((column) => <td key={column}>{displayValue(row[column])}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="panel-empty">The endpoint returned no tabular rows.</div>
              ) : view === "chart" ? (
                chartRows.length ? (
                  <div className="bar-chart">
                    <div className="chart-title">{chartColumn}</div>
                    {chartRows.map((row, index) => {
                      const value = Number(row[chartColumn]);
                      const label = String(row.name ?? row.title ?? row.candidate_name ?? row.committee_name ?? row.id ?? row[Object.keys(row)[0]] ?? index + 1);
                      return (
                        <div className="chart-row" key={index}>
                          <span className="chart-label" title={label}>{label}</span>
                          <div className="chart-track"><span style={{ width: `${chartMax ? (value / chartMax) * 100 : 0}%` }} /></div>
                          <strong>{displayValue(value)}</strong>
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="panel-empty">No numeric field is available for a chart.</div>
              ) : (
                <pre className="raw-json">{JSON.stringify(raw, null, 2)}</pre>
              )}
              {pagination && (
                <div className="pagination-controls">
                  <span>
                    {pagination.count !== undefined
                      ? `${pagination.count.toLocaleString()} total`
                      : `${rows.length} rows`}
                  </span>
                  <div>
                    <button
                      className="page-button"
                      disabled={running || (connectorId === "fec" ? page <= 1 : offset <= 0)}
                      onClick={() => {
                        const nextPage = Math.max(1, page - 1);
                        const nextOffset = Math.max(0, offset - pageSize);
                        void execute(nextPage, nextOffset);
                      }}
                    >
                      Previous
                    </button>
                    <strong>Page {page}</strong>
                    <button
                      className="page-button next"
                      disabled={
                        running ||
                        (connectorId === "fec"
                          ? pagination.pages !== undefined && page >= pagination.pages
                          : !pagination.next)
                      }
                      onClick={() => {
                        const nextPage = page + 1;
                        const nextOffset = offset + pageSize;
                        void execute(nextPage, nextOffset);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
