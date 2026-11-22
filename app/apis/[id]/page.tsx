import Link from "next/link";
import { connection } from "next/server";
import SiteHeader from "@/components/site-header";
import type { APIRecord, DataPreview, VerificationRecord } from "@/lib/types";

export const instant = false;

const baseUrl = () => process.env.GOVAPI_API_URL ?? "http://127.0.0.1:8000";

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  let record: APIRecord | null = null;
  let sources: Array<Record<string, string | null>> = [];
  let verifications: VerificationRecord[] = [];
  let preview: DataPreview | null = null;
  let error = "";

  try {
    const [recordResponse, sourcesResponse, verificationsResponse, previewResponse] = await Promise.all([
      fetch(`${baseUrl()}/v1/apis/${encodeURIComponent(id)}`, { cache: "no-store" }),
      fetch(`${baseUrl()}/v1/apis/${encodeURIComponent(id)}/sources`, { cache: "no-store" }),
      fetch(`${baseUrl()}/v1/apis/${encodeURIComponent(id)}/verifications`, { cache: "no-store" }),
      fetch(`${baseUrl()}/v1/apis/${encodeURIComponent(id)}/preview?limit=50`, { cache: "no-store" }),
    ]);
    if (!recordResponse.ok) throw new Error(recordResponse.status === 404 ? "API record not found." : `Registry API returned ${recordResponse.status}`);
    record = await recordResponse.json();
    if (sourcesResponse.ok) sources = (await sourcesResponse.json()).sources ?? [];
    if (verificationsResponse.ok) verifications = await verificationsResponse.json();
    if (previewResponse.ok) preview = await previewResponse.json();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "The registry API is unavailable.";
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="content-shell">
        <Link href="/" className="back-link">← Back to registry</Link>
        {error || !record ? (
          <div className="error-state">{error || "Record unavailable."}</div>
        ) : (
          <>
            <div className="detail-header">
              <div className="detail-badges">
                <span className="status-chip">{record.jurisdiction}</span>
                <span className="status-chip">{record.verification_status}</span>
                <span className="type-chip dark">{record.record_type ?? "api"}</span>
              </div>
              <div className="detail-title">
                <h1>{record.name}</h1>
                <p>{record.agency} · {record.category}</p>
              </div>
            </div>

            <div className="detail-layout">
              <section className="detail-main">
                <div className="panel">
                  <div className="panel-header">Overview</div>
                  <dl className="detail-grid">
                    {[
                      ["Base URL", record.base_url],
                      ["Documentation", record.documentation_url],
                      ["Authentication", record.authentication],
                      ["Data formats", record.data_format.join(", ")],
                      ["License", record.license ?? "Not specified"],
                      ["Last verified", record.last_verified ? new Date(record.last_verified).toLocaleString() : "Unverified"],
                    ].map(([label, value]) => (
                      <div className="detail-cell" key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="panel">
                  <div className="panel-header">Verification history</div>
                  {verifications.length === 0 ? (
                    <div className="panel-empty">No verification checks have been recorded.</div>
                  ) : (
                    <div className="verification-list">
                      {verifications.map((check) => (
                        <div className="verification-row" key={check.id}>
                          <span className="capitalize">{check.status}</span>
                          <span>HTTP {check.http_status ?? "—"}</span>
                          <time>{new Date(check.checked_at).toLocaleString()}</time>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {preview && (
                  <div className="panel">
                    <div className="panel-header">
                      <span>Data preview</span>
                      <small>{preview.row_count} rows · {preview.format.toUpperCase()}</small>
                    </div>
                    {preview.columns.length === 0 ? (
                      <div className="panel-empty">The source has no tabular rows to preview.</div>
                    ) : (
                      <div className="table-scroll">
                        <table className="preview-table">
                          <thead>
                            <tr>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr>
                          </thead>
                          <tbody>
                            {preview.rows.map((row, index) => (
                              <tr key={index}>
                                {preview.columns.map((column) => (
                                  <td key={column}>{typeof row[column] === "object" ? JSON.stringify(row[column]) : String(row[column] ?? "—")}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {preview.truncated && <div className="preview-note">Showing the first 50 rows. Open the source for the complete dataset.</div>}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <div className="panel">
                  <div className="panel-header">Source references</div>
                  {sources.length === 0 ? (
                    <div className="panel-empty">No source references recorded.</div>
                  ) : (
                    <div className="source-list">
                      {sources.map((source, index) => (
                        <div className="source-row" key={index}>
                          <strong>{source.source_id}</strong>
                          {source.source_record_id && (
                            <Link href={`/apis/${encodeURIComponent(String(source.source_record_id))}`}>Open linked catalog record</Link>
                          )}
                          {source.source_url && <a href={String(source.source_url)} target="_blank" rel="noreferrer">View source</a>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {record.documentation_url && (
                  <a href={record.documentation_url} target="_blank" rel="noreferrer" className="documentation-button">Open documentation</a>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
