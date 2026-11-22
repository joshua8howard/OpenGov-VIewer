import Link from "next/link";
import SiteHeader from "@/components/site-header";

export const instant = false;

export default async function ManagePage() {
  const baseUrl = process.env.GOVAPI_API_URL ?? "http://127.0.0.1:8000";
  let exportDocument = "";
  let error = "";
  try {
    const response = await fetch(`${baseUrl}/v1/export/json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Registry API returned ${response.status}`);
    exportDocument = JSON.stringify(await response.json(), null, 2);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Could not load registry JSON.";
  }

  return (
    <main className="min-h-screen">
      <SiteHeader active="manage" />
      <div className="manage-shell">
        <Link href="/" className="back-link">← Back to registry</Link>
        <div className="manage-heading">
          <div className="eyebrow">Data management</div>
          <h1>Registry JSON</h1>
        </div>

        {error ? (
          <div className="error-state">{error}</div>
        ) : (
          <div className="manage-layout">
            <div className="panel">
              <div className="panel-header">
                <span>Export document</span>
                <small>JSON</small>
              </div>
              <textarea readOnly aria-label="Registry JSON export" value={exportDocument} className="json-area" />
            </div>

            <aside className="space-y-4">
              <div className="panel import-panel">
                <h2>Import JSON</h2>
                <form action="/api/registry/import" method="post">
                  <textarea name="document" required placeholder={'{"apis":[...],"datasets":[...]}' } className="import-area" />
                  <button className="primary-button">Import records</button>
                </form>
              </div>
              <div className="import-note">Imports accept API and dataset arrays. Existing IDs are updated; new IDs are created.</div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
