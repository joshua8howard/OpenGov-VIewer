"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SiteHeader from "@/components/site-header";
import type { APIRecord } from "@/lib/types";

type GlobePoint = {
  key: string;
  name: string;
  lat: number;
  lon: number;
  count: number;
  jurisdictions: Record<string, number>;
  agencies: Record<string, number>;
  records: APIRecord[];
};

type GeoFeature = {
  properties: {
    NAME?: string;
    name?: string;
    ISO_A2?: string;
    iso_a2?: string;
    latitude?: number;
    longitude?: number;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type WorldGeoJson = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

type AdminFeature = {
  properties: {
    name?: string;
    NAME?: string;
    latitude?: number;
    longitude?: number;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

const LOCATIONS: Record<string, { name: string; lat: number; lon: number }> = {
  US: { name: "United States", lat: 38.9, lon: -77.0 },
  CA: { name: "Canada", lat: 45.4, lon: -75.7 },
  GB: { name: "United Kingdom", lat: 51.5, lon: -0.1 },
  DE: { name: "Germany", lat: 52.5, lon: 13.4 },
  FR: { name: "France", lat: 48.8, lon: 2.3 },
  AU: { name: "Australia", lat: -33.8, lon: 151.2 },
  JP: { name: "Japan", lat: 35.7, lon: 139.7 },
  IN: { name: "India", lat: 28.6, lon: 77.2 },
  BR: { name: "Brazil", lat: -15.8, lon: -47.9 },
  MX: { name: "Mexico", lat: 19.4, lon: -99.1 },
};

const STATE_LOCATIONS: Record<string, { name: string; lat: number; lon: number }> = {
  texas: { name: "Texas", lat: 31.5, lon: -99.9 },
  ny: { name: "New York", lat: 42.9, lon: -75.5 },
  "new york": { name: "New York", lat: 42.9, lon: -75.5 },
  california: { name: "California", lat: 36.8, lon: -119.7 },
  florida: { name: "Florida", lat: 27.8, lon: -81.7 },
  washington: { name: "Washington", lat: 47.4, lon: -120.5 },
  colorado: { name: "Colorado", lat: 39.0, lon: -105.5 },
  illinois: { name: "Illinois", lat: 40.6, lon: -89.2 },
};

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Unknown";
}

function inferUSLocation(record: APIRecord) {
  const haystack = `${record.agency} ${record.name} ${record.source_id} ${record.base_url}`.toLowerCase();
  for (const [key, location] of Object.entries(STATE_LOCATIONS)) {
    if (key === "ny") {
      if (haystack.includes("ny.gov") || haystack.includes("new york")) return location;
    } else if (haystack.includes(key)) {
      return location;
    }
  }
  return LOCATIONS.US;
}

export default function GlobePage() {
  const [records, setRecords] = useState<APIRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [yaw, setYaw] = useState(77);
  const [pitch, setPitch] = useState(-38);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [jurisdiction, setJurisdiction] = useState("all");
  const [world, setWorld] = useState<WorldGeoJson | null>(null);
  const [states, setStates] = useState<WorldGeoJson | null>(null);
  const [counties, setCounties] = useState<WorldGeoJson | null>(null);
  const dragging = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const dragFrame = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/registry/apis?limit=100", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("Could not load registry records.");
        return response.json() as Promise<APIRecord[]>;
      }),
      fetch("/world-100m.json", { cache: "force-cache" }).then(async (response) => {
        if (!response.ok) throw new Error("Could not load local world geometry.");
        return response.json() as Promise<WorldGeoJson>;
      }),
      fetch("/states-50m.json", { cache: "force-cache" }).then(async (response) => {
        if (!response.ok) throw new Error("Could not load local state boundaries.");
        return response.json() as Promise<WorldGeoJson>;
      }),
      fetch("/counties.json", { cache: "force-cache" }).then(async (response) => {
        if (!response.ok) throw new Error("Could not load local county boundaries.");
        return response.json() as Promise<WorldGeoJson>;
      }),
    ])
      .then(([recordItems, worldData, stateData, countyData]) => {
        setRecords(recordItems);
        setWorld(worldData);
        setStates(stateData);
        setCounties(countyData);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load the globe."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => jurisdiction === "all" ? records : records.filter((record) => record.jurisdiction === jurisdiction),
    [records, jurisdiction],
  );

  const points = useMemo(() => {
    const grouped = new Map<string, GlobePoint>();
    for (const record of filtered) {
      const country = record.country?.toUpperCase() || "US";
      const location = country === "US" ? inferUSLocation(record) : (LOCATIONS[country] ?? LOCATIONS.US);
      const locationName = country === "US" ? location.name : location.name;
      const key = `${country}-${locationName}-${record.jurisdiction}`;
      const existing = grouped.get(key) ?? {
        key,
        name: country === "US" ? `${locationName} · ${capitalize(record.jurisdiction)}` : location.name,
        lat: location.lat,
        lon: location.lon,
        count: 0,
        jurisdictions: {},
        agencies: {},
        records: [],
      };
      existing.count += 1;
      existing.records.push(record);
      existing.jurisdictions[record.jurisdiction] = (existing.jurisdictions[record.jurisdiction] ?? 0) + 1;
      existing.agencies[record.agency] = (existing.agencies[record.agency] ?? 0) + 1;
      grouped.set(key, existing);
    }
    return Array.from(grouped.values());
  }, [filtered]);

  const radius = 270 * zoom;

  function project(lat: number, lon: number) {
    const latRad = lat * Math.PI / 180;
    const lonRad = (lon + yaw) * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const cosLat = Math.cos(latRad);
    let x = cosLat * Math.sin(lonRad);
    let y = -cosLat * Math.cos(lonRad) * Math.sin(pitchRad) - Math.sin(latRad) * Math.cos(pitchRad);
    const z = cosLat * Math.cos(lonRad) * Math.cos(pitchRad) - Math.sin(latRad) * Math.sin(pitchRad);
    x *= radius;
    y *= radius;
    return { x: 430 + x, y: 330 + y, z };
  }

  function projectedPath(coords: number[][]) {
    let path = "";
    let drawing = false;
    for (const [lon, lat] of coords) {
      const point = project(lat, lon);
      if (point.z > 0.03) {
        path += `${drawing ? " L" : " M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        drawing = true;
      } else {
        drawing = false;
      }
    }
    return path;
  }

  function projectedPolygon(rings: number[][][], stride = 1) {
    return rings.map((ring) => {
      const simplified = stride > 1
        ? ring.filter((_, index) => index % stride === 0 || index === ring.length - 1)
        : ring;
      const path = projectedPath(simplified);
      return path ? `${path} Z` : "";
    }).filter(Boolean).join("");
  }

  function featurePath(feature: GeoFeature, stride = 1) {
    if (feature.geometry.type === "Polygon") {
      return projectedPolygon(feature.geometry.coordinates as number[][][], stride);
    }
    return (feature.geometry.coordinates as number[][][][])
      .map((polygon) => projectedPolygon(polygon, stride))
      .filter(Boolean)
      .join("");
  }

  function polygonCentroid(feature: GeoFeature) {
    if (feature.geometry.type === "Polygon") {
      const ring = (feature.geometry.coordinates as number[][][])[0] ?? [];
      if (!ring.length) return null;
      const sum = ring.reduce((total, coordinate) => ({ lon: total.lon + coordinate[0], lat: total.lat + coordinate[1] }), { lon: 0, lat: 0 });
      return { lon: sum.lon / ring.length, lat: sum.lat / ring.length };
    }
    const polygons = feature.geometry.coordinates as number[][][][];
    const ring = polygons[0]?.[0] ?? [];
    if (!ring.length) return null;
    const sum = ring.reduce((total, coordinate) => ({ lon: total.lon + coordinate[0], lat: total.lat + coordinate[1] }), { lon: 0, lat: 0 });
    return { lon: sum.lon / ring.length, lat: sum.lat / ring.length };
  }

  const selectedPoint = points.find((point) => point.key === selected) ?? points[0];
  const topAgencies = selectedPoint
    ? Object.entries(selectedPoint.agencies).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : [];

  return (
    <main className="min-h-screen globe-page">
      <SiteHeader active="globe" />
      <div className="globe-shell">
        <aside className="globe-sidebar">
          <div className="globe-heading">
            <div className="eyebrow">Geographic registry</div>
            <h1>API Globe</h1>
          </div>

          <label className="field-label globe-filter">
            <span>Jurisdiction</span>
            <select value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)}>
              <option value="all">All jurisdictions</option>
              {["federal", "state", "county", "municipal", "international", "tribal"].map((item) => (
                <option value={item} key={item}>{capitalize(item)}</option>
              ))}
            </select>
          </label>

          <div className="globe-metrics">
            <div><span>Records</span><strong>{filtered.length}</strong></div>
            <div><span>Locations</span><strong>{points.length}</strong></div>
          </div>

          {selectedPoint && (
            <div className="globe-detail">
              <div className="globe-detail-title">
                <span>{selectedPoint.name}</span>
                <strong>{selectedPoint.count}</strong>
              </div>
              <div className="globe-agency-label">Top agencies</div>
              <div className="globe-agencies">
                {topAgencies.map(([agency, count]) => (
                  <div key={agency}>
                    <span title={agency}>{agency}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="globe-stage">
          {loading ? (
            <div className="globe-loading">Loading registry locations…</div>
          ) : error ? (
            <div className="globe-loading globe-error">{error}</div>
          ) : (
            <>
              <div className="globe-toolbar">
                <button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.75, value / 1.35))}>−</button>
                <button aria-label="Reset globe" onClick={() => { setYaw(77); setPitch(-38); setZoom(1); }}>Reset</button>
                <button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(16, value * 1.35))}>+</button>
              </div>
              <svg
                className="globe-svg"
                viewBox="0 0 860 660"
                role="img"
                aria-label="Interactive globe showing government API registry locations"
                onWheel={(event) => {
                  setZoom((value) => Math.max(0.75, Math.min(16, value * (event.deltaY < 0 ? 1.18 : 1 / 1.18))));
                }}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragging.current = { x: event.clientX, y: event.clientY, yaw, pitch };
                }}
                onPointerMove={(event) => {
                  if (!dragging.current) return;
                  if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
                  dragFrame.current = requestAnimationFrame(() => {
                    if (!dragging.current) return;
                    const deltaX = event.clientX - dragging.current.x;
                    const deltaY = event.clientY - dragging.current.y;
                    const dragSensitivity = 0.35 / Math.max(1, zoom);
                    setYaw(dragging.current.yaw + deltaX * dragSensitivity);
                    setPitch(Math.max(-75, Math.min(75, dragging.current.pitch - deltaY * dragSensitivity)));
                    dragFrame.current = null;
                  });
                }}
                onPointerUp={() => {
                  dragging.current = null;
                  if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
                  dragFrame.current = null;
                }}
                onPointerCancel={() => {
                  dragging.current = null;
                  if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
                  dragFrame.current = null;
                }}
              >
                <defs>
                  <radialGradient id="globeSurface" cx="35%" cy="28%" r="75%">
                    <stop offset="0%" stopColor="#1a527f" />
                    <stop offset="58%" stopColor="#123454" />
                    <stop offset="100%" stopColor="#071a2d" />
                  </radialGradient>
                  <radialGradient id="globeHalo">
                    <stop offset="68%" stopColor="#6fb7df" stopOpacity="0" />
                    <stop offset="100%" stopColor="#8fd1f2" stopOpacity=".22" />
                  </radialGradient>
                  <filter id="markerGlow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <linearGradient id="landTint" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#99bca8" />
                    <stop offset="55%" stopColor="#668f7b" />
                    <stop offset="100%" stopColor="#3e685c" />
                  </linearGradient>
                  <pattern id="oceanPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r=".45" fill="#a6d1e3" fillOpacity=".13" />
                    <circle cx="8" cy="7" r=".35" fill="#a6d1e3" fillOpacity=".1" />
                  </pattern>
                </defs>
                <circle cx="430" cy="330" r={radius + 18} fill="url(#globeHalo)" />
                <circle cx="430" cy="330" r={radius} fill="url(#globeSurface)" stroke="#79badc" strokeOpacity=".45" strokeWidth="1.5" />
                <circle cx="430" cy="330" r={radius} fill="url(#oceanPattern)" />

                {[-60, -30, 0, 30, 60].map((lat) => {
                  const coords = Array.from({ length: 73 }, (_, index) => [index * 5 - 180, lat]);
                  return <path key={`lat-${lat}`} d={projectedPath(coords)} fill="none" stroke="#70a6c5" strokeOpacity=".24" strokeWidth=".8" />;
                })}
                {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => {
                  const coords = Array.from({ length: 37 }, (_, index) => [lon, index * 5 - 90]);
                  return <path key={`lon-${lon}`} d={projectedPath(coords)} fill="none" stroke="#70a6c5" strokeOpacity=".24" strokeWidth=".8" />;
                })}

                {world?.features.map((feature, index) => (
                  <path
                    key={`${feature.properties.ISO_A2 || "country"}-${feature.properties.NAME}-${index}`}
                    d={featurePath(feature, zoom >= 1.8 ? 2 : 1)}
                    fill="url(#landTint)"
                    fillOpacity=".82"
                    stroke="#c0d8c9"
                    strokeOpacity=".48"
                    strokeWidth=".8"
                  />
                ))}

                {zoom >= 1.35 && states?.features
                  .filter((feature) => {
                    const lat = feature.properties.latitude;
                    const lon = feature.properties.longitude;
                    return lat !== undefined && lon !== undefined
                      ? project(lat, lon).z > 0.03
                      : false;
                  })
                  .map((feature, index) => (
                    <path
                      key={`province-${feature.properties.iso_a2 ?? "country"}-${feature.properties.name}-${index}`}
                      d={featurePath(feature, zoom >= 2 ? 2 : 1)}
                      fill="none"
                      stroke="#d7ebdc"
                      strokeOpacity={zoom >= 2 ? ".72" : ".48"}
                      strokeWidth={zoom >= 2 ? 1.1 : .8}
                    />
                  ))}

                {zoom >= 16 && counties?.features
                  .filter((feature) => {
                    const centroid = polygonCentroid(feature);
                    return centroid ? project(centroid.lat, centroid.lon).z > 0.08 : false;
                  })
                  .slice(0, 500)
                  .map((feature, index) => (
                    <path
                      key={`county-${feature.properties.NAME}-${index}`}
                      d={featurePath(feature, 4)}
                      fill="#84a98f"
                      fillOpacity=".08"
                      stroke="#d8e9df"
                      strokeOpacity=".58"
                      strokeWidth=".55"
                    />
                  ))}

                {zoom >= 2.5 && states?.features.map((feature, index) => {
                  const name = feature.properties.name;
                  const lat = feature.properties.latitude;
                  const lon = feature.properties.longitude;
                  if (!name || lat === undefined || lon === undefined) return null;
                  const projected = project(lat, lon);
                  if (projected.z < 0.03) return null;
                  return (
                    <text
                      key={`state-label-${name}-${index}`}
                      x={projected.x}
                      y={projected.y}
                      textAnchor="middle"
                      fill="#eff7f1"
                      fillOpacity=".82"
                      stroke="#0b1d2d"
                      strokeWidth="3"
                      paintOrder="stroke"
                      fontSize={zoom >= 3 ? 10 : 8}
                      fontWeight="700"
                    >
                      {name}
                    </text>
                  );
                })}

                {zoom >= 16 && counties?.features.slice(0, 500).map((feature, index) => {
                  const name = feature.properties.NAME;
                  if (!name) return null;
                  const centroid = polygonCentroid(feature);
                  if (!centroid) return null;
                  const projected = project(centroid.lat, centroid.lon);
                  if (projected.z < 0.12) return null;
                  return (
                    <text
                      key={`county-label-${name}-${index}`}
                      x={projected.x}
                      y={projected.y}
                      textAnchor="middle"
                      fill="#edf6fb"
                      fillOpacity=".68"
                      stroke="#0b1d2d"
                      strokeWidth="2.5"
                      paintOrder="stroke"
                      fontSize="7"
                      fontWeight="700"
                    >
                      {name}
                    </text>
                  );
                })}

                {points.map((point) => {
                  const projected = project(point.lat, point.lon);
                  if (projected.z < 0.03) return null;
                  const markerRadius = Math.min(16, 4 + Math.sqrt(point.count) * 1.1);
                  const isSelected = point.key === selected;
                  return (
                    <g
                      key={point.key}
                      className="globe-marker"
                      transform={`translate(${projected.x} ${projected.y})`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(point.key);
                        setYaw(-point.lon);
                        setPitch(-point.lat);
                        setZoom((value) => Math.max(2.25, value));
                      }}
                      role="button"
                      aria-label={`${point.name}: ${point.count} records`}
                    >
                      {isSelected && <circle r={markerRadius + 8} fill="#d4a72c" fillOpacity=".18" stroke="#d4a72c" strokeOpacity=".6" />}
                      <circle r={markerRadius} fill={isSelected ? "#d4a72c" : "#9ad8ef"} fillOpacity=".88" stroke="#e5f5fb" strokeWidth="1" filter="url(#markerGlow)" />
                      {point.count > 9 && <text textAnchor="middle" y="4" fill="#17304d" fontSize="9" fontWeight="800">{point.count}</text>}
                    </g>
                  );
                })}
                <circle cx="430" cy="330" r={radius} fill="none" stroke="#d4effa" strokeOpacity=".32" strokeWidth="1" />
              </svg>
              <div className="globe-coordinate">
                <span>Interactive 3D projection</span>
                <span>Drag to rotate · Use + / − to zoom</span>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
