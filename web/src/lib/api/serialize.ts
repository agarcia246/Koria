import type { Tables } from "@/lib/database.types";
import { BROKER_DISCLOSURE, CATEGORY_API } from "@/lib/disclosures";

export type AirportRow = Tables<"airports">;
export type AircraftRow = Tables<"aircraft">;
export type ModelRow = Tables<"aircraft_models">;
export type OperatorRow = Tables<"operators">;
export type PhotoRow = Tables<"aircraft_photos">;
export type BookingRow = Tables<"bookings">;
export type QuoteRow = Tables<"quotes">;
export type TripRow = Tables<"trip_requests">;
export type EmptyLegRow = Tables<"empty_legs">;

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export function photoPublicUrl(storagePath: string): string {
  if (storagePath.startsWith("http")) return storagePath;
  return `${PUBLIC_URL}/storage/v1/object/public/aircraft-photos/${storagePath}`;
}

export function serializeAirport(a: AirportRow) {
  return {
    id: a.id,
    icao: a.icao,
    iata: a.iata ?? "",
    name: a.name,
    city: a.city,
    region: a.region ?? "",
    country: a.country,
    time_zone: a.time_zone ?? "",
    latitude: a.latitude,
    longitude: a.longitude,
  };
}

export function amenitiesFromAircraft(ac: AircraftRow) {
  const items: { id: string; name: string; kind: string }[] = [];
  if (ac.wifi) items.push({ id: "wifi", name: "Wi-Fi", kind: "wifi" });
  if (ac.lavatory) items.push({ id: "lavatory", name: "Lavatory", kind: "lavatory" });
  if (ac.pets) items.push({ id: "pets", name: "Pets", kind: "pets" });
  if (ac.golf) items.push({ id: "golf", name: "Golf", kind: "golf" });
  if (ac.skis) items.push({ id: "skis", name: "Skis", kind: "ski" });
  return items;
}

function asNumber(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function serializeModel(m: ModelRow) {
  return {
    id: m.id,
    manufacturer: m.manufacturer,
    name: m.name,
    category: CATEGORY_API[m.category] ?? m.category,
    range_nm: Math.round(asNumber(m.range_nm)),
    cruise_speed_ktas: Math.round(asNumber(m.cruise_speed_ktas)),
    typical_pax: m.typical_pax,
    max_pax: m.max_pax,
    cabin_length_ft: asNumber(m.cabin_length_ft),
    cabin_width_ft: asNumber(m.cabin_width_ft),
    cabin_height_ft: asNumber(m.cabin_height_ft),
    baggage_cu_ft: Math.round(asNumber(m.baggage_cu_ft)),
  };
}

export function serializeOperatorProfile(op: OperatorRow) {
  return {
    id: op.id,
    name: op.name,
    code: op.code,
    city: op.city ?? "",
    legal_name: op.legal_name,
    dba: op.dba,
  };
}

export function serializeListing(args: {
  aircraft: AircraftRow;
  model: ModelRow;
  operator: OperatorRow;
  photos: PhotoRow[];
}) {
  const { aircraft, model, operator, photos } = args;
  const amenities = amenitiesFromAircraft(aircraft);
  return {
    aircraft: {
      id: aircraft.id,
      tail_number: aircraft.tail_number,
      operator_id: aircraft.operator_id,
      model_id: aircraft.model_id,
      seating: aircraft.seating,
      year: aircraft.year ?? 0,
      amenity_ids: amenities.map((item) => item.id),
      pet_policy: aircraft.pet_policy ?? "",
      cabin_notes: aircraft.cabin_notes ?? "",
      interior_configuration: aircraft.interior_configuration,
      baggage_cu_ft:
        aircraft.baggage_cu_ft == null ? null : Math.round(asNumber(aircraft.baggage_cu_ft)),
      home_base_id: aircraft.home_base_id ?? "",
      wifi: aircraft.wifi,
      lavatory: aircraft.lavatory,
      pets: aircraft.pets,
      golf: aircraft.golf,
      skis: aircraft.skis,
      photo_urls: photos
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => photoPublicUrl(p.storage_path)),
    },
    model: serializeModel(model),
    operator_profile: serializeOperatorProfile(operator),
    amenities,
  };
}

export function serializeBooking(b: BookingRow | null) {
  if (!b) return null;
  return {
    id: b.id,
    trip_id: b.trip_request_id,
    quote_id: b.quote_id,
    status: b.status,
    created_at: b.created_at,
    operating_carrier_legal_name: b.operating_carrier_legal_name,
    operating_carrier_dba: b.operating_carrier_dba,
    certificate_number: b.certificate_number,
    broker_role_disclosure: b.broker_role_disclosure ?? BROKER_DISCLOSURE,
    operator_amount: Number(b.operator_amount),
    platform_fee_amount: Number(b.platform_fee_amount),
    taxes_amount: Number(b.taxes_amount),
    customer_total: Number(b.customer_total),
    currency: b.currency,
    fbo: b.fbo,
  };
}

export function serializeTrip(
  trip: TripRow,
  origin: AirportRow,
  destination: AirportRow,
  booking: BookingRow | null,
) {
  const prefs = (trip.prefs ?? {}) as Record<string, unknown>;
  return {
    id: trip.id,
    created_at: trip.created_at,
    origin: serializeAirport(origin),
    destination: serializeAirport(destination),
    departure_date: trip.depart_at,
    return_date: trip.return_at,
    passengers: trip.passengers,
    aircraft_id: trip.aircraft_id,
    empty_leg_id: trip.empty_leg_id,
    notes: trip.notes ?? "",
    pets: Boolean(prefs.pets),
    wifi_preferred: Boolean(prefs.wifi_preferred),
    golf: Boolean(prefs.golf),
    skis: Boolean(prefs.skis),
    baggage: Boolean(prefs.baggage),
    status: trip.status,
    booking: serializeBooking(booking),
    cancellation_reason: trip.cancellation_reason,
    cancelled_by: trip.cancelled_by,
  };
}

export function serializeQuote(q: QuoteRow, operatorName: string) {
  return {
    id: q.id,
    trip_id: q.trip_request_id,
    aircraft_id: q.aircraft_id,
    operator_name: operatorName,
    price: {
      mode: q.pricing_mode,
      amount: {
        amount: Number(q.customer_total),
        currency: q.currency,
      },
    },
    operator_amount: Number(q.operator_amount),
    platform_fee_amount: Number(q.platform_fee_amount),
    taxes_amount: Number(q.taxes_amount),
    customer_total: Number(q.customer_total),
    currency: q.currency,
    valid_until: q.valid_until,
    operator_notes: q.notes,
    status: q.status,
    created_at: q.created_at,
    carrier_disclosure_snapshot: q.carrier_disclosure_snapshot,
  };
}

export { BROKER_DISCLOSURE };
