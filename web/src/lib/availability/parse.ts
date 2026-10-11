/**
 * Operator availability files.
 *
 * iCal: every VEVENT is a blocked window. The aircraft is busy for that
 * event. iCal has no available/blocked flag, so this importer does not treat
 * events as free time. CSV rows may set kind to blocked or available; a
 * missing kind is blocked.
 *
 * Re-upload semantics live in the portal action: it deletes this aircraft's
 * source = import rows, then inserts the new batch. Manual and api rows stay.
 */

export type AvailabilityKindName = "blocked" | "available";

export type ParsedWindow = {
  starts_at: string;
  ends_at: string;
  kind: AvailabilityKindName;
  notes: string | null;
};

export type ParseResult = {
  rows: ParsedWindow[];
  errors: string[];
};

const MAX_ROWS = 500;

export function parseAvailabilityFile(filename: string, text: string): ParseResult {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { rows: [], errors: ["The file is empty."] };
  const lower = filename.toLowerCase();
  if (lower.endsWith(".ics") || trimmed.startsWith("BEGIN:VCALENDAR")) {
    return cap(parseIcal(trimmed));
  }
  if (lower.endsWith(".csv") || trimmed.includes(",")) {
    return cap(parseCsv(trimmed));
  }
  return { rows: [], errors: ["Upload an .ics calendar or a .csv file."] };
}

function cap(result: ParseResult): ParseResult {
  if (result.rows.length > MAX_ROWS) {
    return { rows: [], errors: [`A file can import at most ${MAX_ROWS} windows.`] };
  }
  return result;
}

function parseCsv(text: string): ParseResult {
  const records = splitCsv(text);
  if (records.length === 0) return { rows: [], errors: ["The CSV has no rows."] };
  const header = records[0].map((cell) => cell.trim().toLowerCase());
  const startIdx = header.indexOf("starts_at");
  const endIdx = header.indexOf("ends_at");
  if (startIdx < 0 || endIdx < 0) {
    return { rows: [], errors: ["CSV needs starts_at and ends_at columns."] };
  }
  const kindIdx = header.indexOf("kind");
  const notesIdx = header.indexOf("notes");
  const rows: ParsedWindow[] = [];
  const errors: string[] = [];
  records.slice(1).forEach((cells, index) => {
    if (cells.every((cell) => cell.trim() === "")) return;
    const line = index + 2;
    const kindRaw = kindIdx >= 0 ? cells[kindIdx]?.trim().toLowerCase() : "";
    const kind: AvailabilityKindName = kindRaw === "available" ? "available" : "blocked";
    if (kindRaw && kindRaw !== "available" && kindRaw !== "blocked") {
      errors.push(`Row ${line}: kind must be blocked or available.`);
      return;
    }
    const window = windowFrom(cells[startIdx] ?? "", cells[endIdx] ?? "", kind, notesIdx >= 0 ? cells[notesIdx] : "");
    if ("error" in window) errors.push(`Row ${line}: ${window.error}`);
    else rows.push(window);
  });
  return { rows, errors };
}

/** iCal VEVENTs are blocked. They mean the aircraft is not free. */
function parseIcal(text: string): ParseResult {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const events = unfolded.split("BEGIN:VEVENT").slice(1);
  if (events.length === 0) return { rows: [], errors: [] };
  const rows: ParsedWindow[] = [];
  const errors: string[] = [];
  events.forEach((block, index) => {
    const body = block.split("END:VEVENT")[0] ?? "";
    const start = icalProp(body, "DTSTART");
    const end = icalProp(body, "DTEND");
    const summary = icalProp(body, "SUMMARY")?.value ?? "";
    if (!start || !end) {
      errors.push(`Event ${index + 1}: needs DTSTART and DTEND.`);
      return;
    }
    const starts = icalInstant(start);
    const ends = icalInstant(end);
    if ("error" in starts) {
      errors.push(`Event ${index + 1}: ${starts.error}`);
      return;
    }
    if ("error" in ends) {
      errors.push(`Event ${index + 1}: ${ends.error}`);
      return;
    }
    if (ends.iso <= starts.iso) {
      errors.push(`Event ${index + 1}: end must be after start.`);
      return;
    }
    rows.push({
      starts_at: starts.iso,
      ends_at: ends.iso,
      kind: "blocked",
      notes: summary.trim() || null,
    });
  });
  return { rows, errors };
}

function icalProp(body: string, name: string): { params: string; value: string } | null {
  const line = body.split("\n").find((row) => row.startsWith(`${name}:`) || row.startsWith(`${name};`));
  if (!line) return null;
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  return { params: line.slice(name.length, colon), value: line.slice(colon + 1).trim() };
}

function icalInstant(prop: { params: string; value: string }): { iso: string } | { error: string } {
  const value = prop.value;
  const tzid = /TZID=([^;:]+)/i.exec(prop.params)?.[1];
  if (/^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const mo = Number(value.slice(4, 6));
    const d = Number(value.slice(6, 8));
    return { iso: new Date(Date.UTC(y, mo - 1, d)).toISOString() };
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!match) return { error: `unsupported time ${value}` };
  const [, ys, mos, ds, hs, mins, ss, z] = match;
  const y = Number(ys);
  const mo = Number(mos);
  const d = Number(ds);
  const h = Number(hs);
  const mi = Number(mins);
  const s = Number(ss);
  if (z === "Z" || !tzid) {
    if (z !== "Z" && tzid == null && !prop.params.includes("VALUE=DATE")) {
      // Floating times have no zone. Store them as UTC and say so in the note path
      // only when a TZID is missing and the stamp is not Z. Reject those so a
      // local wall time is not silently shifted.
      if (z !== "Z") return { error: `${value} needs a Z or a TZID` };
    }
    return { iso: new Date(Date.UTC(y, mo - 1, d, h, mi, s)).toISOString() };
  }
  try {
    return { iso: zonedToUtc(y, mo, d, h, mi, s, tzid).toISOString() };
  } catch {
    return { error: `unknown time zone ${tzid}` };
  }
}

function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const offset = zoneOffsetMs(utcGuess, timeZone);
  const adjusted = new Date(utcGuess.getTime() - offset);
  const offset2 = zoneOffsetMs(adjusted, timeZone);
  return new Date(utcGuess.getTime() - offset2);
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour") % 24, pick("minute"), pick("second"));
  return asUtc - instant.getTime();
}

function windowFrom(
  startRaw: string,
  endRaw: string,
  kind: AvailabilityKindName,
  notesRaw: string | undefined,
): ParsedWindow | { error: string } {
  const start = new Date(startRaw.trim());
  const end = new Date(endRaw.trim());
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "starts_at and ends_at must be ISO-8601 timestamps." };
  }
  if (end <= start) return { error: "end must be after start." };
  const notes = (notesRaw ?? "").trim();
  return {
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    kind,
    notes: notes || null,
  };
}

function splitCsv(text: string): string[][] {
  const source = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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
        } else inQuotes = false;
      } else field += c;
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
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}
