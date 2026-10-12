/** OpenAPI for the operator inbound API. Rate limiting is not part of this contract. */
export const operatorOpenApi = {
  openapi: "3.0.3",
  info: {
    title: "KORIA operator API",
    version: "1.0.0",
    description:
      "Operators push their own aircraft, availability, and empty legs. " +
      "Authorize with `Authorization: Bearer <api key>`. The key is an operator key minted in the portal, not a user JWT. " +
      "The server resolves the operator from a hash of the key and writes only that operator's rows. " +
      "A key cannot read or write another operator. Rate limiting is out of scope.",
  },
  servers: [{ url: "/api/v1/operator" }],
  components: {
    securitySchemes: {
      operatorKey: { type: "http", scheme: "bearer" },
    },
  },
  security: [{ operatorKey: [] }],
  paths: {
    "/aircraft": {
      get: {
        summary: "List this operator's aircraft",
        responses: { "200": { description: "Aircraft rows for the key's operator" }, "401": { description: "Missing or revoked key" } },
      },
      put: {
        summary: "Upsert one aircraft by tail number",
        description:
          "Matches (operator_id, tail_number). operator_id always comes from the key. " +
          "is_active true is rejected with 403 until an operator admin has accepted the current operator agreement. " +
          "Aircraft that are already active are not deactivated.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["tail_number", "model_id", "seating"],
                properties: {
                  tail_number: { type: "string" },
                  model_id: { type: "string", format: "uuid" },
                  seating: { type: "integer" },
                  year: { type: "integer", nullable: true },
                  wifi: { type: "boolean" },
                  lavatory: { type: "boolean" },
                  pets: { type: "boolean" },
                  golf: { type: "boolean" },
                  skis: { type: "boolean" },
                  baggage_cu_ft: { type: "number", nullable: true },
                  home_base_icao: { type: "string", nullable: true },
                  is_active: { type: "boolean" },
                  pricing_mode_default: { type: "string", enum: ["live", "estimated", "quote_required"] },
                  cabin_notes: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Upserted aircraft" },
          "400": { description: "Invalid body" },
          "401": { description: "Unauthorized" },
          "403": { description: "is_active is true and the current operator agreement is not accepted" },
        },
      },
    },
    "/availability": {
      get: {
        summary: "List this operator's availability",
        parameters: [{ name: "tail_number", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Windows for the key's aircraft" } },
      },
      put: {
        summary: "Replace API availability for one aircraft",
        description:
          "Deletes rows with source = api for that aircraft, then inserts the body. Manual and imported windows are left alone. " +
          "kind is blocked or available.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["tail_number", "windows"],
                properties: {
                  tail_number: { type: "string" },
                  windows: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["starts_at", "ends_at"],
                      properties: {
                        starts_at: { type: "string", format: "date-time" },
                        ends_at: { type: "string", format: "date-time" },
                        kind: { type: "string", enum: ["blocked", "available"] },
                        notes: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Replaced API windows" } },
      },
    },
    "/empty-legs": {
      get: {
        summary: "List this operator's empty legs",
        responses: { "200": { description: "Empty legs for the key's operator" } },
      },
      put: {
        summary: "Upsert this operator's empty legs",
        description: "Each leg is inserted, or updated when id belongs to this operator. operator_id is never taken from the body.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["legs"],
                properties: {
                  legs: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["tail_number", "origin_icao", "destination_icao", "depart_at"],
                      properties: {
                        id: { type: "string", format: "uuid" },
                        tail_number: { type: "string" },
                        origin_icao: { type: "string" },
                        destination_icao: { type: "string" },
                        depart_at: { type: "string", format: "date-time" },
                        seats_available: { type: "integer", nullable: true },
                        price: { type: "number", nullable: true },
                        pricing_mode: { type: "string", enum: ["live", "estimated", "quote_required"] },
                        status: { type: "string", enum: ["published", "withdrawn", "booked"] },
                        notes: { type: "string", nullable: true },
                        whole_aircraft: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Upserted legs" } },
      },
    },
  },
} as const;
