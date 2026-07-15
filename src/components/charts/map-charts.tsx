'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { COLORS, buildChartData, resolveAxes, drillDownMessage } from './chart-utils';
import type { QueryResult } from '@/lib/types';
import { BarChartRenderer } from './recharts-charts';

declare global {
  interface Window {
    google?: any;
  }
}

// ---------------------------------------------------------------------------
// Shared hook: Google Maps script loader
// ---------------------------------------------------------------------------

// Shared error setter so gm_authFailure can update all mounted map instances
let _mapsAuthError: (() => void) | null = null;

if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    if (_mapsAuthError) _mapsAuthError();
  };
}

function useGoogleMaps(): { loaded: boolean; error: string | null } {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = localStorage.getItem('google_maps_api_key')
      || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      || '';
    if (!apiKey) {
      setError('Google Maps API key not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the environment.');
      return;
    }

    // Register auth failure handler so gm_authFailure can trigger fallback
    _mapsAuthError = () => setError('Google Maps API key is invalid or restricted for this domain.');

    if (window.google?.maps) {
      setLoaded(true);
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const poll = setInterval(() => {
        if (window.google?.maps) {
          setLoaded(true);
          clearInterval(poll);
        }
      }, 100);
      return () => clearInterval(poll);
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError('Failed to load Google Maps. Check your API key.');
    document.head.appendChild(script);

    return () => { _mapsAuthError = null; };
  }, []);

  return { loaded, error };
}

// ---------------------------------------------------------------------------
// Shared fallback component
// ---------------------------------------------------------------------------

export function MapFallback({ message }: { message: string }) {
  return (
    <div style={{
      width: '100%', height: 360, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--surface-2)',
      border: '1px solid var(--border)', borderRadius: 8,
      flexDirection: 'column', gap: 12,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--text-muted)' }}>map</span>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 300 }}>{message}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

interface ChartProps {
  result: QueryResult;
  onSendMessage: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// US state coordinate lookup (all 50 states + DC)
// ---------------------------------------------------------------------------

const STATE_COORDS: Record<string, { lat: number; lng: number; abbr: string }> = {};

const RAW_STATES: Array<[string, string, number, number]> = [
  ['Alabama', 'AL', 32.806671, -86.791130],
  ['Alaska', 'AK', 61.370716, -152.404419],
  ['Arizona', 'AZ', 33.729759, -111.431221],
  ['Arkansas', 'AR', 34.969704, -92.373123],
  ['California', 'CA', 36.116203, -119.681564],
  ['Colorado', 'CO', 39.059811, -105.311104],
  ['Connecticut', 'CT', 41.597782, -72.755371],
  ['Delaware', 'DE', 39.318523, -75.507141],
  ['Florida', 'FL', 27.766279, -81.686783],
  ['Georgia', 'GA', 33.040619, -83.643074],
  ['Hawaii', 'HI', 21.094318, -157.498337],
  ['Idaho', 'ID', 44.240459, -114.478828],
  ['Illinois', 'IL', 40.349457, -88.986137],
  ['Indiana', 'IN', 39.849426, -86.258278],
  ['Iowa', 'IA', 42.011539, -93.210526],
  ['Kansas', 'KS', 38.526600, -96.726486],
  ['Kentucky', 'KY', 37.668140, -84.670067],
  ['Louisiana', 'LA', 31.169546, -91.867805],
  ['Maine', 'ME', 44.693947, -69.381927],
  ['Maryland', 'MD', 39.063946, -76.802101],
  ['Massachusetts', 'MA', 42.230171, -71.530106],
  ['Michigan', 'MI', 43.326618, -84.536095],
  ['Minnesota', 'MN', 45.694454, -93.900192],
  ['Mississippi', 'MS', 32.741646, -89.678696],
  ['Missouri', 'MO', 38.456085, -92.288368],
  ['Montana', 'MT', 46.921925, -110.454353],
  ['Nebraska', 'NE', 41.125370, -98.268082],
  ['Nevada', 'NV', 38.313515, -117.055374],
  ['New Hampshire', 'NH', 43.452492, -71.563896],
  ['New Jersey', 'NJ', 40.298904, -74.521011],
  ['New Mexico', 'NM', 34.840515, -106.248482],
  ['New York', 'NY', 42.165726, -74.948051],
  ['North Carolina', 'NC', 35.630066, -79.806419],
  ['North Dakota', 'ND', 47.528912, -99.784012],
  ['Ohio', 'OH', 40.388783, -82.764915],
  ['Oklahoma', 'OK', 35.565342, -96.928917],
  ['Oregon', 'OR', 44.572021, -122.070938],
  ['Pennsylvania', 'PA', 40.590752, -77.209755],
  ['Rhode Island', 'RI', 41.680893, -71.511780],
  ['South Carolina', 'SC', 33.856892, -80.945007],
  ['South Dakota', 'SD', 44.299782, -99.438828],
  ['Tennessee', 'TN', 35.747845, -86.692345],
  ['Texas', 'TX', 31.054487, -97.563461],
  ['Utah', 'UT', 40.150032, -111.862434],
  ['Vermont', 'VT', 44.045876, -72.710686],
  ['Virginia', 'VA', 37.769337, -78.169968],
  ['Washington', 'WA', 47.400902, -121.490494],
  ['West Virginia', 'WV', 38.491226, -80.954456],
  ['Wisconsin', 'WI', 44.268543, -89.616508],
  ['Wyoming', 'WY', 42.755966, -107.302490],
  ['District of Columbia', 'DC', 38.897438, -77.026817],
];

for (const [name, abbr, lat, lng] of RAW_STATES) {
  const entry = { lat, lng, abbr };
  STATE_COORDS[abbr] = entry;
  STATE_COORDS[abbr.toLowerCase()] = entry;
  STATE_COORDS[name.toLowerCase()] = entry;
}

// ---------------------------------------------------------------------------
// Country coordinate lookup (top 60 countries by GDP + common codes)
// ---------------------------------------------------------------------------

const COUNTRY_COORDS: Record<string, { lat: number; lng: number; name: string }> = {};

const RAW_COUNTRIES: Array<[string, string, number, number]> = [
  ['United States', 'US', 39.8283, -98.5795],
  ['China', 'CN', 35.8617, 104.1954],
  ['Japan', 'JP', 36.2048, 138.2529],
  ['Germany', 'DE', 51.1657, 10.4515],
  ['India', 'IN', 20.5937, 78.9629],
  ['United Kingdom', 'GB', 55.3781, -3.4360],
  ['France', 'FR', 46.6034, 1.8883],
  ['Italy', 'IT', 41.8719, 12.5674],
  ['Brazil', 'BR', -14.2350, -51.9253],
  ['Canada', 'CA', 56.1304, -106.3468],
  ['Russia', 'RU', 61.5240, 105.3188],
  ['South Korea', 'KR', 35.9078, 127.7669],
  ['Australia', 'AU', -25.2744, 133.7751],
  ['Spain', 'ES', 40.4637, -3.7492],
  ['Mexico', 'MX', 23.6345, -102.5528],
  ['Indonesia', 'ID', -0.7893, 113.9213],
  ['Netherlands', 'NL', 52.1326, 5.2913],
  ['Saudi Arabia', 'SA', 23.8859, 45.0792],
  ['Turkey', 'TR', 38.9637, 35.2433],
  ['Switzerland', 'CH', 46.8182, 8.2275],
  ['Taiwan', 'TW', 23.6978, 120.9605],
  ['Poland', 'PL', 51.9194, 19.1451],
  ['Sweden', 'SE', 60.1282, 18.6435],
  ['Belgium', 'BE', 50.5039, 4.4699],
  ['Norway', 'NO', 60.4720, 8.4689],
  ['Austria', 'AT', 47.5162, 14.5501],
  ['Israel', 'IL', 31.0461, 34.8516],
  ['Ireland', 'IE', 53.1424, -7.6921],
  ['Singapore', 'SG', 1.3521, 103.8198],
  ['Argentina', 'AR', -38.4161, -63.6167],
  ['South Africa', 'ZA', -30.5595, 22.9375],
  ['Thailand', 'TH', 15.8700, 100.9925],
  ['Denmark', 'DK', 56.2639, 9.5018],
  ['Philippines', 'PH', 12.8797, 121.7740],
  ['Malaysia', 'MY', 4.2105, 101.9758],
  ['Colombia', 'CO', 4.5709, -74.2973],
  ['Nigeria', 'NG', 9.0820, 8.6753],
  ['Finland', 'FI', 61.9241, 25.7482],
  ['Chile', 'CL', -35.6751, -71.5430],
  ['Egypt', 'EG', 26.8206, 30.8025],
  ['Portugal', 'PT', 39.3999, -8.2245],
  ['Czech Republic', 'CZ', 49.8175, 15.4730],
  ['New Zealand', 'NZ', -40.9006, 174.8860],
  ['Peru', 'PE', -9.1900, -75.0152],
  ['Romania', 'RO', 45.9432, 24.9668],
  ['Greece', 'GR', 39.0742, 21.8243],
  ['Vietnam', 'VN', 14.0583, 108.2772],
  ['UAE', 'AE', 23.4241, 53.8478],
  ['Bangladesh', 'BD', 23.6850, 90.3563],
  ['Pakistan', 'PK', 30.3753, 69.3451],
  ['Kenya', 'KE', -0.0236, 37.9062],
  ['Ghana', 'GH', 7.9465, -1.0232],
  ['Ethiopia', 'ET', 9.1450, 40.4897],
  ['Tanzania', 'TZ', -6.3690, 34.8888],
  ['Morocco', 'MA', 31.7917, -7.0926],
  ['Ukraine', 'UA', 48.3794, 31.1656],
  ['Hungary', 'HU', 47.1625, 19.5033],
  ['Qatar', 'QA', 25.3548, 51.1839],
  ['Kuwait', 'KW', 29.3117, 47.4818],
];

for (const [name, code, lat, lng] of RAW_COUNTRIES) {
  const entry = { lat, lng, name };
  COUNTRY_COORDS[code] = entry;
  COUNTRY_COORDS[code.toLowerCase()] = entry;
  COUNTRY_COORDS[name.toLowerCase()] = entry;
}

// Also map common alternative names
COUNTRY_COORDS['usa'] = COUNTRY_COORDS['us'];
COUNTRY_COORDS['united states of america'] = COUNTRY_COORDS['us'];
COUNTRY_COORDS['uk'] = COUNTRY_COORDS['gb'];
COUNTRY_COORDS['great britain'] = COUNTRY_COORDS['gb'];
COUNTRY_COORDS['korea'] = COUNTRY_COORDS['kr'];
COUNTRY_COORDS['republic of korea'] = COUNTRY_COORDS['kr'];
COUNTRY_COORDS['uae'] = COUNTRY_COORDS['ae'];
COUNTRY_COORDS['united arab emirates'] = COUNTRY_COORDS['ae'];
COUNTRY_COORDS['czechia'] = COUNTRY_COORDS['cz'];


// ---------------------------------------------------------------------------
// detectChoroplethType: inspect query result to decide USA_MAP vs WORLD_MAP
// ---------------------------------------------------------------------------

export function detectChoroplethType(result: QueryResult): 'USA_MAP' | 'WORLD_MAP' {
  if (!result.columns.length || !result.rows.length) return 'WORLD_MAP';

  // Find the dimension column (first non-numeric column, or column 0)
  let dimIdx = 0;
  for (let i = 0; i < result.columns.length; i++) {
    const hasNumeric = result.rows.some((r) => typeof r[i] === 'number');
    const hasString = result.rows.some((r) => typeof r[i] === 'string' && r[i]);
    if (hasString && !hasNumeric) { dimIdx = i; break; }
  }

  // Sample up to 15 rows
  const sample = result.rows
    .slice(0, 15)
    .map((r) => String(r[dimIdx] ?? '').trim())
    .filter(Boolean);

  if (sample.length === 0) return 'WORLD_MAP';

  let stateHits = 0;
  let countryHits = 0;

  for (const val of sample) {
    const lower = val.toLowerCase();
    if (STATE_COORDS[lower] || STATE_COORDS[val]) {
      stateHits++;
    } else if (COUNTRY_COORDS[lower] || COUNTRY_COORDS[val.toUpperCase()] || COUNTRY_COORDS[val]) {
      // Exclude US-only entries that are also state abbreviations
      if (!STATE_COORDS[lower] && !STATE_COORDS[val]) {
        countryHits++;
      }
    }
  }

  // Need at least one confident match; if ambiguous, prefer WORLD_MAP
  if (stateHits > countryHits) return 'USA_MAP';
  return 'WORLD_MAP';
}

// ---------------------------------------------------------------------------
// 1. GeoPointMapRenderer
// ---------------------------------------------------------------------------

const LAT_NAMES = ['latitude', 'lat'];
const LNG_NAMES = ['longitude', 'lng', 'long', 'lon'];

function findColumnByNames(columns: string[], candidates: string[]): string | null {
  // Exact match first
  for (const col of columns) {
    if (candidates.includes(col.toLowerCase())) return col;
  }
  // Suffix match (e.g. circuit_latitude)
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (candidates.some(c => lower.endsWith('_' + c))) return col;
  }
  return null;
}

export function GeoPointMapRenderer({ result, onSendMessage }: ChartProps) {
  const { loaded, error } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const data = useMemo(
    () => buildChartData(result.columns, result.rows),
    [result.columns, result.rows],
  );

  const latCol = useMemo(() => findColumnByNames(result.columns, LAT_NAMES), [result.columns]);
  const lngCol = useMemo(() => findColumnByNames(result.columns, LNG_NAMES), [result.columns]);

  const valueCol = useMemo(() => {
    if (!latCol || !lngCol) return null;
    const skip = new Set([latCol.toLowerCase(), lngCol.toLowerCase()]);
    for (const col of result.columns) {
      if (skip.has(col.toLowerCase())) continue;
      // Check if at least one row has a numeric value for this column
      const idx = result.columns.indexOf(col);
      const hasNumeric = result.rows.some((r) => typeof r[idx] === 'number');
      if (hasNumeric) return col;
    }
    return null;
  }, [result.columns, result.rows, latCol, lngCol]);

  const center = useMemo(() => {
    if (!latCol || !lngCol || data.length === 0) return { lat: 0, lng: 0 };
    let totalLat = 0;
    let totalLng = 0;
    let count = 0;
    for (const row of data) {
      const lat = Number(row[latCol]);
      const lng = Number(row[lngCol]);
      if (!isNaN(lat) && !isNaN(lng)) {
        totalLat += lat;
        totalLng += lng;
        count++;
      }
    }
    if (count === 0) return { lat: 0, lng: 0 };
    return { lat: totalLat / count, lng: totalLng / count };
  }, [data, latCol, lngCol]);

  useEffect(() => {
    if (!loaded || !mapRef.current || !latCol || !lngCol) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 3,
    });
    mapInstanceRef.current = map;

    const markers: any[] = [];
    for (const row of data) {
      const lat = Number(row[latCol]);
      const lng = Number(row[lngCol]);
      if (isNaN(lat) || isNaN(lng)) continue;

      const marker = new window.google.maps.Marker({
        map,
        position: { lat, lng },
        title: valueCol ? `${valueCol}: ${row[valueCol]}` : `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      });
      marker.addListener('click', () => {
        if (!onSendMessage || !valueCol) return;
        onSendMessage(drillDownMessage(valueCol, row[valueCol]));
      });
      markers.push(marker);
    }
    markersRef.current = markers;

    return () => {
      for (const m of markersRef.current) {
        m.map = null;
      }
      markersRef.current = [];
    };
  }, [loaded, data, latCol, lngCol, valueCol, center]);

  if (error) return <MapFallback message={error} />;
  if (!latCol || !lngCol) {
    return <MapFallback message="Could not detect latitude/longitude columns. Expected column names like lat, latitude, lng, longitude." />;
  }
  if (!loaded) return <MapFallback message="Loading Google Maps..." />;

  return (
    <div style={{ width: '100%', height: 400, borderRadius: 8, overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. USAMapRenderer
// ---------------------------------------------------------------------------

export function USAMapRenderer({ result, onSendMessage }: ChartProps) {
  const { loaded, error } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const data = useMemo(
    () => buildChartData(result.columns, result.rows),
    [result.columns, result.rows],
  );

  const { xKey, yKeys } = useMemo(
    () => resolveAxes(result.columns, result.xAxis, result.yAxis),
    [result.columns, result.xAxis, result.yAxis],
  );

  const valueKey = yKeys[0] ?? result.columns[1];

  // Compute max value for proportional sizing
  const maxValue = useMemo(() => {
    let max = 0;
    for (const row of data) {
      const v = Number(row[valueKey]);
      if (!isNaN(v) && v > max) max = v;
    }
    return max || 1;
  }, [data, valueKey]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
    });
    mapInstanceRef.current = map;

    const markers: any[] = [];
    for (const row of data) {
      const stateKey = String(row[xKey] ?? '').trim();
      const coords = STATE_COORDS[stateKey] ?? STATE_COORDS[stateKey.toLowerCase()];
      if (!coords) continue;

      const value = Number(row[valueKey]);
      const ratio = isNaN(value) ? 0.3 : value / maxValue;
      const radius = Math.max(8, Math.min(30, 8 + ratio * 22));

      const marker = new window.google.maps.Marker({
        map,
        position: { lat: coords.lat, lng: coords.lng },
        title: `${coords.abbr}: ${isNaN(value) ? 'N/A' : value}`,
        label: {
          text: coords.abbr,
          color: '#fff',
          fontSize: '10px',
          fontWeight: '600',
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: radius,
          fillColor: COLORS[0],
          fillOpacity: 0.7,
          strokeColor: 'rgba(255,255,255,0.8)',
          strokeWeight: 2,
        },
      });
      marker.addListener('click', () => {
        if (!onSendMessage) return;
        onSendMessage(drillDownMessage(xKey, stateKey));
      });
      markers.push(marker);
    }
    markersRef.current = markers;

    return () => {
      for (const m of markersRef.current) {
        m.map = null;
      }
      markersRef.current = [];
    };
  }, [loaded, data, xKey, valueKey, maxValue]);

  if (error) return <MapFallback message={error} />;
  if (!loaded) return <MapFallback message="Loading Google Maps..." />;

  return (
    <div style={{ width: '100%', height: 400, borderRadius: 8, overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. WorldMapRenderer -- choropleth via Google Maps Data layer + GeoJSON
// ---------------------------------------------------------------------------

// ISO-3 → ISO-2 mapping for the most common countries (covers Natural Earth GeoJSON SU_A3 codes)
const ISO3_TO_ISO2: Record<string, string> = {
  USA: 'US', CHN: 'CN', JPN: 'JP', DEU: 'DE', IND: 'IN', GBR: 'GB', FRA: 'FR', ITA: 'IT',
  BRA: 'BR', CAN: 'CA', RUS: 'RU', KOR: 'KR', AUS: 'AU', ESP: 'ES', MEX: 'MX', IDN: 'ID',
  NLD: 'NL', SAU: 'SA', TUR: 'TR', CHE: 'CH', TWN: 'TW', POL: 'PL', SWE: 'SE', BEL: 'BE',
  NOR: 'NO', AUT: 'AT', ISR: 'IL', IRL: 'IE', SGP: 'SG', ARG: 'AR', ZAF: 'ZA', THA: 'TH',
  DNK: 'DK', PHL: 'PH', MYS: 'MY', COL: 'CO', NGA: 'NG', FIN: 'FI', CHL: 'CL', EGY: 'EG',
  PRT: 'PT', CZE: 'CZ', NZL: 'NZ', PER: 'PE', ROU: 'RO', GRC: 'GR', VNM: 'VN', ARE: 'AE',
  BGD: 'BD', PAK: 'PK', KEN: 'KE', GHA: 'GH', ETH: 'ET', TZA: 'TZ', MAR: 'MA', UKR: 'UA',
  HUN: 'HU', QAT: 'QA', KWT: 'KW', IRN: 'IR', IRQ: 'IQ', AFG: 'AF', AGO: 'AO', ALB: 'AL',
  DZA: 'DZ', AND: 'AD', ATG: 'AG', ARM: 'AM', AZE: 'AZ', BHS: 'BS', BHR: 'BH', BLR: 'BY',
  BLZ: 'BZ', BEN: 'BJ', BTN: 'BT', BOL: 'BO', BIH: 'BA', BWA: 'BW', BRN: 'BN', BGR: 'BG',
  BFA: 'BF', BDI: 'BI', CPV: 'CV', KHM: 'KH', CMR: 'CM', CAF: 'CF', TCD: 'TD', COM: 'KM',
  COD: 'CD', COG: 'CG', CRI: 'CR', CIV: 'CI', HRV: 'HR', CUB: 'CU', CYP: 'CY', DJI: 'DJ',
  DOM: 'DO', ECU: 'EC', SLV: 'SV', GNQ: 'GQ', ERI: 'ER', EST: 'EE', SWZ: 'SZ', FJI: 'FJ',
  GAB: 'GA', GMB: 'GM', GEO: 'GE', GTM: 'GT', GIN: 'GN', GNB: 'GW', GUY: 'GY', HTI: 'HT',
  HND: 'HN', ISL: 'IS', JAM: 'JM', JOR: 'JO', KAZ: 'KZ', KIR: 'KI', PRK: 'KP', KGZ: 'KG',
  LAO: 'LA', LVA: 'LV', LBN: 'LB', LSO: 'LS', LBR: 'LR', LBY: 'LY', LIE: 'LI', LTU: 'LT',
  LUX: 'LU', MDG: 'MG', MWI: 'MW', MDV: 'MV', MLI: 'ML', MLT: 'MT', MHL: 'MH', MRT: 'MR',
  MUS: 'MU', FSM: 'FM', MDA: 'MD', MCO: 'MC', MNG: 'MN', MNE: 'ME', MOZ: 'MZ', MMR: 'MM',
  NAM: 'NA', NPL: 'NP', NIC: 'NI', NER: 'NE', MKD: 'MK', OMN: 'OM', PLW: 'PW', PAN: 'PA',
  PNG: 'PG', PRY: 'PY', PRI: 'PR', MDA2: 'MD', SEN: 'SN', SRB: 'RS', SLE: 'SL', SVK: 'SK',
  SVN: 'SI', SLB: 'SB', SOM: 'SO', SSD: 'SS', LKA: 'LK', SDN: 'SD', SUR: 'SR', SYR: 'SY',
  STP: 'ST', TJK: 'TJ', TLS: 'TL', TGO: 'TG', TON: 'TO', TTO: 'TT', TUN: 'TN', TKM: 'TM',
  TUV: 'TV', UGA: 'UG', URY: 'UY', UZB: 'UZ', VUT: 'VU', VEN: 'VE', WSM: 'WS', YEM: 'YE',
  ZMB: 'ZM', ZWE: 'ZW',
};

// Interpolate a value in [0,1] to a blue choropleth color
function choroplethColor(ratio: number): string {
  // Light blue (#dbeafe) → deep blue (#1e3a8a)
  const r = Math.round(219 - ratio * (219 - 30));
  const g = Math.round(190 - ratio * (190 - 58));
  const b = Math.round(254 - ratio * (254 - 138));
  return `rgb(${r},${g},${b})`;
}

// Build a lookup: ISO-2, ISO-3, and full name → numeric value
function buildCountryValueMap(
  data: Record<string, any>[],
  xKey: string,
  valueKey: string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of data) {
    const key = String(row[xKey] ?? '').trim();
    const val = Number(row[valueKey]);
    if (!key || isNaN(val)) continue;

    const lower = key.toLowerCase();
    // Index by whatever the user provided
    map.set(lower, val);

    // If it looks like ISO-2 (2 chars), also index the name
    if (key.length === 2) {
      const coords = COUNTRY_COORDS[key.toUpperCase()] ?? COUNTRY_COORDS[lower];
      if (coords) map.set(coords.name.toLowerCase(), val);
    }
    // If it looks like ISO-3 (3 chars), also resolve to ISO-2
    if (key.length === 3) {
      const iso2 = ISO3_TO_ISO2[key.toUpperCase()];
      if (iso2) {
        map.set(iso2.toLowerCase(), val);
        const coords = COUNTRY_COORDS[iso2];
        if (coords) map.set(coords.name.toLowerCase(), val);
      }
    }
  }
  return map;
}

// Resolve a GeoJSON feature's country names/codes to a value
function resolveFeatureValue(
  properties: Record<string, any>,
  valueMap: Map<string, number>,
): number | null {
  const candidates: string[] = [
    properties.ADMIN,
    properties.NAME,
    properties.name,
    properties.SU_A3,
    properties.ADM0_A3,
    properties.ISO_A2,
    properties.ISO_A3,
  ].filter(Boolean).map((s: string) => s.toLowerCase());

  // Also resolve ISO-3 → ISO-2
  if (properties.ADM0_A3) {
    const iso2 = ISO3_TO_ISO2[properties.ADM0_A3.toUpperCase()];
    if (iso2) candidates.push(iso2.toLowerCase());
  }
  if (properties.ISO_A3) {
    const iso2 = ISO3_TO_ISO2[properties.ISO_A3.toUpperCase()];
    if (iso2) candidates.push(iso2.toLowerCase());
  }

  for (const c of candidates) {
    if (valueMap.has(c)) return valueMap.get(c)!;
  }
  return null;
}

export function WorldMapRenderer({ result, onSendMessage }: ChartProps) {
  const { loaded, error } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const data = useMemo(
    () => buildChartData(result.columns, result.rows),
    [result.columns, result.rows],
  );

  const { xKey, yKeys } = useMemo(
    () => resolveAxes(result.columns, result.xAxis, result.yAxis),
    [result.columns, result.xAxis, result.yAxis],
  );

  const valueKey = yKeys[0] ?? result.columns[1];

  const { valueMap, maxValue, minValue } = useMemo(() => {
    const vm = buildCountryValueMap(data, xKey, valueKey);
    let max = 0;
    let min = Infinity;
    for (const v of vm.values()) {
      if (v > max) max = v;
      if (v < min) min = v;
    }
    if (min === Infinity) min = 0;
    return { valueMap: vm, maxValue: max || 1, minValue: min };
  }, [data, xKey, valueKey]);

  const formatValue = useCallback((v: number) => {
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return v.toLocaleString();
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 25, lng: 0 },
      zoom: 2,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { featureType: 'water', stylers: [{ color: '#c8d7e8' }] },
        { featureType: 'landscape', stylers: [{ color: '#f5f7fa' }] },
        { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#8a9bb0' }, { weight: 0.8 }] },
        { featureType: 'road', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      ],
    });
    mapInstanceRef.current = map;

    const infoWindow = new window.google.maps.InfoWindow();

    // Load GeoJSON from public Natural Earth dataset
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
      .then((r) => r.json())
      .then((geojson) => {
        map.data.addGeoJson(geojson);

        map.data.setStyle((feature: any) => {
          const props = feature.f ?? feature.j ?? {};
          // Try to get properties via the Maps API accessor
          const getName = (k: string) => {
            try { return feature.getProperty(k); } catch { return undefined; }
          };
          const properties = {
            ADMIN: getName('ADMIN'),
            NAME: getName('NAME'),
            name: getName('name'),
            SU_A3: getName('SU_A3'),
            ADM0_A3: getName('ADM0_A3'),
            ISO_A2: getName('ISO_A2'),
            ISO_A3: getName('ISO_A3'),
          };

          const value = resolveFeatureValue(properties, valueMap);
          if (value === null) {
            return {
              fillColor: '#e2e8f0',
              fillOpacity: 1.0,
              strokeColor: '#8a9bb0',
              strokeWeight: 0.5,
            };
          }
          const range = maxValue - minValue;
          const ratio = range > 0 ? (value - minValue) / range : 0.5;
          return {
            fillColor: choroplethColor(ratio),
            fillOpacity: 1.0,
            strokeColor: '#ffffff',
            strokeWeight: 0.8,
          };
        });

        // Click to show info window
        map.data.addListener('click', (event: any) => {
          const getName = (k: string) => {
            try { return event.feature.getProperty(k); } catch { return undefined; }
          };
          const properties = {
            ADMIN: getName('ADMIN'),
            NAME: getName('NAME'),
            name: getName('name'),
            SU_A3: getName('SU_A3'),
            ADM0_A3: getName('ADM0_A3'),
            ISO_A2: getName('ISO_A2'),
            ISO_A3: getName('ISO_A3'),
          };

          const countryName = properties.ADMIN || properties.NAME || properties.name || 'Unknown';
          const value = resolveFeatureValue(properties, valueMap);
          const displayValue = value !== null ? formatValue(value) : 'No data';

          infoWindow.setContent(
            `<div style="font-family:system-ui,sans-serif;padding:4px 2px;min-width:140px">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${countryName}</div>
              <div style="font-size:12px;color:#475569">${valueKey}: <strong>${displayValue}</strong></div>
            </div>`
          );
          infoWindow.setPosition(event.latLng);
          infoWindow.open(map);

        });
      })
      .catch(() => {
        // GeoJSON load failed -- fall back to bubble markers
        for (const row of data) {
          const countryKey = String(row[xKey] ?? '').trim();
          const coords = COUNTRY_COORDS[countryKey] ?? COUNTRY_COORDS[countryKey.toLowerCase()];
          if (!coords) continue;
          const value = Number(row[valueKey]);
          const ratio = isNaN(value) ? 0.3 : value / maxValue;
          const radius = Math.max(8, Math.min(30, 8 + ratio * 22));
          new window.google.maps.Marker({
            map,
            position: { lat: coords.lat, lng: coords.lng },
            title: `${coords.name}: ${isNaN(value) ? 'N/A' : value}`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: radius,
              fillColor: COLORS[4],
              fillOpacity: 0.7,
              strokeColor: 'rgba(255,255,255,0.8)',
              strokeWeight: 2,
            },
          });
        }
      });

    return () => {
      mapInstanceRef.current = null;
    };
  }, [loaded, data, xKey, valueKey, valueMap, maxValue, minValue, formatValue]);

  if (error) return <MapFallback message={error} />;
  if (!loaded) return <MapFallback message="Loading Google Maps..." />;

  return (
    <div style={{ position: 'relative', width: '100%', height: 420, borderRadius: 8, overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {/* Choropleth legend */}
      <div style={{
        position: 'absolute', bottom: 28, left: 10,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
        borderRadius: 6, padding: '8px 12px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
        fontFamily: 'system-ui, sans-serif', fontSize: 11,
        pointerEvents: 'none',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 5, fontSize: 11, color: '#374151' }}>
          {valueKey}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#6b7280' }}>{formatValue(minValue)}</span>
          <div style={{
            width: 100, height: 10, borderRadius: 4,
            background: 'linear-gradient(to right, #dbeafe, #1e3a8a)',
          }} />
          <span style={{ fontSize: 10, color: '#6b7280' }}>{formatValue(maxValue)}</span>
        </div>
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#e2e8f0', border: '1px solid #cbd5e1' }} />
          <span style={{ fontSize: 10, color: '#9ca3af' }}>No data</span>
        </div>
      </div>
    </div>
  );
}
