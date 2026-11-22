import type { APIRecord, DataPreview, SourceFacet, VerificationRecord } from "./types";

export const API_BASE = process.env.GOVAPI_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { accept: "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Registry API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getRecords(params: URLSearchParams): Promise<APIRecord[]> {
  return request<APIRecord[]>(`/v1/apis?${params.toString()}`);
}

export function getRecord(id: string): Promise<APIRecord> {
  return request<APIRecord>(`/v1/apis/${encodeURIComponent(id)}`);
}

export function getVerifications(id: string): Promise<VerificationRecord[]> {
  return request<VerificationRecord[]>(`/v1/apis/${encodeURIComponent(id)}/verifications`);
}

export function getSources(id: string): Promise<{ canonical_id: string | null; sources: Array<Record<string, string | null>> }> {
  return request(`/v1/apis/${encodeURIComponent(id)}/sources`);
}

export function getPreview(id: string, limit = 50): Promise<DataPreview> {
  return request<DataPreview>(`/v1/apis/${encodeURIComponent(id)}/preview?limit=${limit}`);
}

export function getSourceFacets(): Promise<SourceFacet[]> {
  return request<SourceFacet[]>("/v1/sources");
}
