type Fields = Record<string, unknown>;

function write(level: "info" | "error", event: string, fields: Fields) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

/** Structured JSON logs. Fields: event, request_id, table, message. */
export function logInfo(event: string, fields: Fields = {}) {
  write("info", event, fields);
}

export function logError(event: string, fields: Fields = {}) {
  write("error", event, fields);
}
