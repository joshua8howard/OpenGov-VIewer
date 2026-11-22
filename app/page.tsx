import Link from "next/link";
import { connection } from "next/server";
import SiteHeader from "@/components/site-header";
import type { AgencyFacet, APIRecord, SourceFacet } from "@/lib/types";

export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function text(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const q = text(params.q);
  const jurisdiction = text(params.jurisdiction);
  const category = text(params.category);
  const agency = text(params.agency);
  const recordType = text(params.record_type);
  const sourceId = text(params.source_id);
  const offset = Number(text(params.offset) || 0);

  const upstream = new URLSearchParams({ limit: "100", offset: String(offset) });
  if (q) upstream.set("q", q);
  if (jurisdiction) upstream.set("jurisdiction", jurisdiction);
  if (category) upstream.set("category", category);
  if (agency) upstream.set("agency", agency);
  if (recordType) upstream.set("record_type", recordType);
  if (sourceId) upstream.set("source_id", sourceId);

  let records: APIRecord[] = [];
  let sources: SourceFacet[] = [];
  let agencies: AgencyFacet[] = [];
  let stats: { apis: number; datasets: number; sources: number; verified: number; jurisdictions: Array<{ jurisdiction: string; count: number }>; categories: Array<{ category: string; count: number }> } | null = null;
  let error = "";
  try {
    const baseUrl = process.env.GOVAPI_API_URL ?? "http://127.0.0.1:8000";
    const setParams = (target: URLSearchParams, include: ("agency" | "source" )[]) => {
      if (q) target.set("q", q);
      if (jurisdiction) target.set("jurisdiction", jurisdiction);
      if (category) target.set("category", category);
      if (recordType) target.set("record_type", recordType);
      if (include.includes("agency") && agency) target.set("agency", agency);
      if (include.includes("source") && sourceId) target.set("source_id", sourceId);
    };
    const agencyFacetParams = new URLSearchParams();
    const sourceFacetParams = new URLSearchParams();
    const statsParams = new URLSearchParams();
    setParams(agencyFacetParams, ["source"]);
    setParams(sourceFacetParams, ["agency"]);
    setParams(statsParams, ["agency", "source"]);

    const recordsUrl = recordType === "dataset"
      ? `${baseUrl}/v1/datasets?${upstream}`
      : recordType === "api"
        ? `${baseUrl}/v1/apis?${upstream}`
        : recordType === "catalog"
          ? `${baseUrl}/v1/apis?${upstream}`
          : `${baseUrl}/v1/records?${upstream}`;
    const [recordsResponse, sourcesResponse, agenciesResponse, statsResponse] = await Promise.all([
      fetch(recordsUrl, { cache: "no-store" }),
      fetch(`${baseUrl}/v1/source-facets?${sourceFacetParams}`, { cache: "no-store" }),
      fetch(`${baseUrl}/v1/agency-facets?${agencyFacetParams}`, { cache: "no-store" }),
      fetch(`${baseUrl}/v1/statistics?${statsParams}`, { cache: "no-store" }),
    ]);
    if (!recordsResponse.ok) throw new Error(`Registry API returned ${recordsResponse.status}`);
    const recordPayload = await recordsResponse.json();
    records = recordType === "dataset"
      ? recordPayload.map((dataset: {
          id: string;
          title: string;
          agency: string;
          jurisdiction: APIRecord["jurisdiction"];
          category: string;
          landing_page: string;
          source_id: string;
          formats: string[];
        }) => ({
          id: dataset.id,
          name: dataset.title,
          agency: dataset.agency,
          jurisdiction: dataset.jurisdiction,
          category: dataset.category,
          base_url: dataset.landing_page,
          documentation_url: dataset.landing_page,
          authentication: "unknown",
          data_format: dataset.formats as APIRecord["data_format"],
          record_type: "dataset",
          status: "unknown",
          source_url: dataset.landing_page,
          source_id: dataset.source_id,
          verification_status: "unverified",
          country: "US",
          created_at: "",
          updated_at: "",
        } satisfies APIRecord))
      : recordPayload;
    if (sourcesResponse.ok) sources = await sourcesResponse.json();
    if (agenciesResponse.ok) agencies = await agenciesResponse.json();
    if (statsResponse.ok) stats = await statsResponse.json();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "The registry API is unavailable.";
  }

  const paginationParams = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    ...(category ? { category } : {}),
    ...(agency ? { agency } : {}),
    ...(recordType ? { record_type: recordType } : {}),
    ...(sourceId ? { source_id: sourceId } : {}),
  });

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="shell page-layout">
        <aside className="filter-panel">
          <div className="filter-heading">Filter records</div>
          <form className="filter-form">
            {q && <input type="hidden" name="q" value={q} />}
            <label className="field-label">
              <span>Jurisdiction</span>
              <select name="jurisdiction" defaultValue={jurisdiction}>
                <option value="">All jurisdictions</option>
                <option value="federal">Federal</option>
                <option value="state">State</option>
                <option value="county">County</option>
                <option value="municipal">Municipal</option>
                <option value="international">International</option>
                <option value="tribal">Tribal</option>
              </select>
            </label>
            <label className="field-label">
              <span>Category</span>
              <select name="category" defaultValue={category}>
                <option value="">All categories</option>
                {stats?.categories.map((option) => (
                  <option key={option.category} value={option.category}>
                    {option.category} ({option.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              <span>Agency</span>
              <select name="agency" defaultValue={agency}>
                <option value="">All agencies</option>
                {agencies.map((option) => (
                  <option key={option.agency} value={option.agency}>
                    {option.agency} ({option.record_count})
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              <span>Record type</span>
              <select name="record_type" defaultValue={recordType}>
                <option value="">All types</option>
                <option value="api">API</option>
                <option value="dataset">Dataset</option>
                <option value="catalog">Catalog</option>
              </select>
            </label>
            <label className="field-label">
              <span>Source</span>
              <select name="source_id" defaultValue={sourceId}>
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option key={source.source_id} value={source.source_id}>
                    {source.source_id.replace(/^(socrata|ckan):/, "")} ({source.record_count})
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button">Apply filters</button>
          </form>
        </aside>

        <section className="registry-main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">Discovery directory</div>
              <h1>Government API Registry</h1>
            </div>
            <div className="record-count"><strong>{stats ? stats.apis + stats.datasets : records.length}</strong> matching records</div>
          </div>

          <form className="search-form">
            <input name="q" defaultValue={q} placeholder="Search agencies, APIs, and categories" className="search-field" />
            {jurisdiction && <input type="hidden" name="jurisdiction" value={jurisdiction} />}
            {category && <input type="hidden" name="category" value={category} />}
            {agency && <input type="hidden" name="agency" value={agency} />}
            {recordType && <input type="hidden" name="record_type" value={recordType} />}
            {sourceId && <input type="hidden" name="source_id" value={sourceId} />}
            <button className="search-button">Search registry</button>
          </form>

          {stats && (
            <div className="stat-grid">
              {[["APIs", stats.apis], ["Datasets", stats.datasets], ["Sources", stats.sources], ["Verified", stats.verified]].map(([label, value]) => (
                <div className="stat-card" key={String(label)}>
                  <span>{label}</span>
                  <strong>{String(value)}</strong>
                </div>
              ))}
            </div>
          )}

          {stats && stats.categories.length > 0 && (
            <div className="category-panel">
              <div className="category-heading">Top categories</div>
              <div className="category-grid">
                {stats.categories.slice(0, 8).map((item) => {
                  const max = Math.max(...stats.categories.map((row) => row.count));
                  const width = Math.max(8, Math.round((item.count / max) * 100));
                  return (
                    <div className="category-row" key={item.category}>
                      <span className="category-name" title={item.category}>{item.category}</span>
                      <div className="category-bar"><span style={{ width: `${width}%` }} /></div>
                      <span className="category-count">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error ? (
            <div className="error-state">{error}</div>
          ) : records.length === 0 ? (
            <div className="empty-state">No API records found. Try a broader search.</div>
          ) : (
            <div className="table-shell">
              <div className="table-scroll">
                <table className="registry-table">
                  <thead>
                    <tr>
                      <th>API or dataset</th>
                      <th>Agency</th>
                      <th>Jurisdiction</th>
                      <th>Verification</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <Link href={`/apis/${encodeURIComponent(record.id)}`} className="record-link">{record.name}</Link>
                          <div className="record-meta">
                            <span>{record.category}</span>
                            <span className="type-chip">{record.record_type ?? "api"}</span>
                          </div>
                        </td>
                        <td>{record.agency}</td>
                        <td className="capitalize">{record.jurisdiction}</td>
                        <td><span className="status-chip">{record.verification_status}</span></td>
                        <td className="text-[#627184]">{record.source_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pagination">
            {offset > 0 && (
              <Link href={`/?${new URLSearchParams({ ...Object.fromEntries(paginationParams), offset: String(Math.max(0, offset - 100)) }).toString()}`} className="page-button">Previous</Link>
            )}
            {records.length === 100 && (
              <Link href={`/?${new URLSearchParams({ ...Object.fromEntries(paginationParams), offset: String(offset + 100) }).toString()}`} className="page-button next">Next</Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
