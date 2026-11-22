export type APIRecord = {
  id: string;
  name: string;
  agency: string;
  jurisdiction: "federal" | "state" | "county" | "municipal" | "international" | "tribal";
  country: string;
  category: string;
  base_url: string;
  documentation_url: string;
  authentication: "none" | "api_key" | "oauth2" | "basic" | "unknown";
  data_format: string[];
  record_type?: "api" | "dataset" | "catalog";
  canonical_id?: string | null;
  license?: string | null;
  last_verified?: string | null;
  status: "active" | "degraded" | "deprecated" | "unknown" | "unverified";
  openapi_spec_url?: string | null;
  source_url: string;
  source_id: string;
  source_record_id?: string | null;
  discovered_at?: string | null;
  verification_status: "unverified" | "healthy" | "degraded" | "unauthenticated" | "unreachable";
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type VerificationRecord = {
  id: number;
  api_record_id: string;
  checked_at: string;
  status: string;
  http_status: number | null;
  response_time_ms: number | null;
  content_type: string | null;
  response_bytes: number;
};

export type DataPreview = {
  record_id: string;
  source_url: string;
  format: "json" | "csv";
  content_type: string;
  row_count: number;
  columns: string[];
  truncated: boolean;
  rows: Array<Record<string, unknown>>;
};

export type SourceFacet = {
  source_id: string;
  record_count: number;
};

export type AgencyFacet = {
  agency: string;
  record_count: number;
};

export type Connector = {
  id: string;
  name: string;
  base_url: string;
  authentication: "api_key";
  operations: string[];
};

export type ConnectorOperation = {
  name: string;
  path: string;
};
