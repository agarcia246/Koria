/**
 * Upsert the OurAirports catalog into `public.airports`.
 *
 * Reads airports.csv + runways.csv (downloaded, or passed as --airports / --runways).
 * Excludes closed, heliport, seaplane_base, and balloonport. Keeps a row only when it
 * has a 4-character ICAO (icao_code, otherwise ident). Upserts on `icao` and does not
 * send `id` or `fbo_name`, so a rerun cannot duplicate codes, cannot change primary
 * keys that demo trips reference, and cannot wipe an FBO name entered later.
 *
 * OurAirports does not ship a time zone. Every imported row gets an IANA zone from
 * its coordinates via geo-tz. A coordinate the boundary data does not cover falls
 * back to UTC and is counted in the summary (`tz_fallback`).
 *
 * Run from this directory:
 *   npm install
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import
 *   npm run import -- --dry-run
 *
 * Staging uses STAGING_SUPABASE_URL and STAGING_SERVICE_ROLE_KEY from
 * ~/.config/koria/secrets.env when the SUPABASE_* vars are unset.
 * There is no production database yet; point the same script at it once one exists.
 */
import { createClient } from "@supabase/supabase-js";
import { find as findTimeZone } from "geo-tz";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const RUNWAYS_URL = "https://davidmegginson.github.io/ourairports-data/runways.csv";
const EXCLUDED_TYPES = new Set(["closed", "heliport", "seaplane_base", "balloonport"]);
const TYPE_RANK: Record<string, number> = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
};
const BATCH = 400;

type Candidate = {
  ident: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
  typeRank: number;
  scheduled: boolean;
  runwayLengthFt: number | null;
};

type Summary = {
  level: "info";
  event: "airport_import";
  ts: string;
  read: number;
  excluded_type: number;
  skipped_no_icao: number;
  skipped_bad_coords: number;
  duplicate_icao_dropped: number;
  iata_cleared_as_duplicate: number;
  upserted: number;
  with_runway: number;
  with_tz: number;
  tz_fallback: number;
  dry_run: boolean;
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseCsv(text: string): Record<string, string>[] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inQuotes) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0] ?? [];
  return rows.slice(1).filter((cells) => cells.some((cell) => cell !== "")).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = cells[index] ?? "";
    });
    return record;
  });
}

function icaoOf(row: Record<string, string>): string | null {
  // Prefer the current ICAO. OurAirports keeps a historical ident when the code
  // changes (Palm Beach ident KPBI, icao_code KDJT). Matching the old ident would
  // rewrite the seeded row's icao and hide the code the catalog actually uses.
  const icao = row.icao_code?.trim().toUpperCase() ?? "";
  if (/^[A-Z][A-Z0-9]{3}$/.test(icao)) return icao;
  const ident = row.ident?.trim().toUpperCase() ?? "";
  if (/^[A-Z][A-Z0-9]{3}$/.test(ident)) return ident;
  return null;
}

function iataOf(row: Record<string, string>): string | null {
  const iata = row.iata_code?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(iata) ? iata : null;
}

function longestRunways(rows: Record<string, string>[]): Map<string, number> {
  const lengths = new Map<string, number>();
  for (const row of rows) {
    if (row.closed === "1") continue;
    const length = Number(row.length_ft);
    if (!Number.isFinite(length) || length <= 0) continue;
    const ident = row.airport_ident?.trim().toUpperCase() ?? "";
    if (!ident) continue;
    const prev = lengths.get(ident) ?? 0;
    if (length > prev) lengths.set(ident, Math.round(length));
  }
  return lengths;
}

function better(a: Candidate, b: Candidate): boolean {
  if (a.typeRank !== b.typeRank) return a.typeRank < b.typeRank;
  if (a.scheduled !== b.scheduled) return a.scheduled;
  return (a.runwayLengthFt ?? 0) > (b.runwayLengthFt ?? 0);
}

function buildCatalog(airports: Record<string, string>[], runways: Record<string, string>[]) {
  const runwayByIdent = longestRunways(runways);
  const summary = {
    read: airports.length,
    excluded_type: 0,
    skipped_no_icao: 0,
    skipped_bad_coords: 0,
    duplicate_icao_dropped: 0,
    iata_cleared_as_duplicate: 0,
  };
  const byIcao = new Map<string, Candidate>();

  for (const row of airports) {
    const type = row.type?.trim() ?? "";
    if (EXCLUDED_TYPES.has(type)) {
      summary.excluded_type++;
      continue;
    }
    const icao = icaoOf(row);
    if (!icao) {
      summary.skipped_no_icao++;
      continue;
    }
    const latitude = Number(row.latitude_deg);
    const longitude = Number(row.longitude_deg);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      summary.skipped_bad_coords++;
      continue;
    }
    const ident = row.ident?.trim().toUpperCase() || icao;
    const candidate: Candidate = {
      ident,
      icao,
      iata: iataOf(row),
      name: (row.name || icao).trim(),
      city: (row.municipality || row.name || icao).trim(),
      region: row.iso_region?.trim() || null,
      country: (row.iso_country || "ZZ").trim(),
      latitude,
      longitude,
      typeRank: TYPE_RANK[type] ?? 3,
      scheduled: row.scheduled_service === "yes",
      runwayLengthFt: runwayByIdent.get(ident) ?? null,
    };
    const existing = byIcao.get(icao);
    if (!existing) byIcao.set(icao, candidate);
    else if (better(candidate, existing)) {
      byIcao.set(icao, candidate);
      summary.duplicate_icao_dropped++;
    } else summary.duplicate_icao_dropped++;
  }

  const usedIata = new Set<string>();
  const ranked = Array.from(byIcao.values()).sort((a, b) => {
    if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank;
    if (a.scheduled !== b.scheduled) return a.scheduled ? -1 : 1;
    return (b.runwayLengthFt ?? 0) - (a.runwayLengthFt ?? 0);
  });
  for (const row of ranked) {
    if (!row.iata) continue;
    if (usedIata.has(row.iata)) {
      row.iata = null;
      summary.iata_cleared_as_duplicate++;
    } else usedIata.add(row.iata);
  }

  return { rows: Array.from(byIcao.values()), summary };
}

function timeZoneFor(latitude: number, longitude: number): { zone: string; fallback: boolean } {
  try {
    const zones = findTimeZone(latitude, longitude);
    const zone = zones.find((value) => value && value !== "Etc/GMT" && value !== "Etc/UTC");
    if (zone) return { zone, fallback: false };
  } catch {
    // geo-tz throws on a coordinate outside its grid. UTC keeps the row importable.
  }
  return { zone: "UTC", fallback: true };
}

async function loadCsv(pathOrUrl: string, fallbackUrl: string): Promise<string> {
  if (pathOrUrl) return readFile(pathOrUrl, "utf8");
  const response = await fetch(fallbackUrl);
  if (!response.ok) throw new Error(`Failed to download ${fallbackUrl}: ${response.status}`);
  return response.text();
}

function readSecretsFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function resolveTarget(): Promise<{ url: string; key: string } | null> {
  let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    const home = process.env.HOME;
    if (home) {
      try {
        const secrets = readSecretsFile(
          await readFile(join(home, ".config/koria/secrets.env"), "utf8"),
        );
        url = url || secrets.STAGING_SUPABASE_URL || "";
        key = key || secrets.STAGING_SERVICE_ROLE_KEY || "";
      } catch {
        // The file is optional when the env vars are already set.
      }
    }
  }
  if (!url || !key) return null;
  return { url, key };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const airportsPath = arg("--airports") ?? "";
  const runwaysPath = arg("--runways") ?? "";
  const [airportsCsv, runwaysCsv] = await Promise.all([
    loadCsv(airportsPath, AIRPORTS_URL),
    loadCsv(runwaysPath, RUNWAYS_URL),
  ]);
  const { rows, summary } = buildCatalog(parseCsv(airportsCsv), parseCsv(runwaysCsv));

  let withRunway = 0;
  let withTz = 0;
  let tzFallback = 0;
  const payload = rows.map((row) => {
    const tz = timeZoneFor(row.latitude, row.longitude);
    if (row.runwayLengthFt != null) withRunway++;
    if (tz.fallback) tzFallback++;
    else withTz++;
    return {
      icao: row.icao,
      iata: row.iata,
      name: row.name,
      city: row.city,
      region: row.region,
      country: row.country,
      time_zone: tz.zone,
      latitude: row.latitude,
      longitude: row.longitude,
      runway_length_ft: row.runwayLengthFt,
    };
  });

  let upserted = 0;
  if (!dryRun) {
    const target = await resolveTarget();
    if (!target) {
      throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or provide staging secrets.");
    }
    const supabase = createClient(target.url, target.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (let i = 0; i < payload.length; i += BATCH) {
      const batch = payload.slice(i, i + BATCH);
      const { error } = await supabase.from("airports").upsert(batch, { onConflict: "icao" });
      if (error) throw new Error(`Upsert failed at row ${i}: ${error.message}`);
      upserted += batch.length;
      if (upserted % 2000 === 0 || upserted === payload.length) {
        console.log(
          JSON.stringify({
            level: "info",
            event: "airport_import_batch",
            ts: new Date().toISOString(),
            upserted,
            total: payload.length,
          }),
        );
      }
    }
  }

  const report: Summary = {
    level: "info",
    event: "airport_import",
    ts: new Date().toISOString(),
    read: summary.read,
    excluded_type: summary.excluded_type,
    skipped_no_icao: summary.skipped_no_icao,
    skipped_bad_coords: summary.skipped_bad_coords,
    duplicate_icao_dropped: summary.duplicate_icao_dropped,
    iata_cleared_as_duplicate: summary.iata_cleared_as_duplicate,
    upserted: dryRun ? payload.length : upserted,
    with_runway: withRunway,
    with_tz: withTz,
    tz_fallback: tzFallback,
    dry_run: dryRun,
  };
  console.log(JSON.stringify(report));
  if (process.env.AIRPORT_IMPORT_REPORT) {
    await writeFile(process.env.AIRPORT_IMPORT_REPORT, JSON.stringify(report, null, 2));
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "import failed";
  console.error(JSON.stringify({ level: "error", event: "airport_import_failed", ts: new Date().toISOString(), message }));
  process.exit(1);
});
