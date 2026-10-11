/** Shared aircraft filter used by search and trip fan-out. */
export const RANGE_MARGIN = 1.15;

export type EligibilityAircraft = {
  id: string;
  is_active: boolean;
  seating: number;
  pets: boolean;
  wifi: boolean;
  golf: boolean;
  skis: boolean;
  baggage_cu_ft: number | null;
};

export type EligibilityBlock = {
  aircraft_id: string;
  starts_at: string;
  ends_at: string;
};

export type EligibilityRequest = {
  passengers: number;
  pets?: boolean;
  wifi_preferred?: boolean;
  golf?: boolean;
  skis?: boolean;
  baggage?: boolean;
  departAt: Date;
  distanceNm: number;
};

export function isAircraftEligible(input: {
  aircraft: EligibilityAircraft;
  rangeNm: number;
  blocks: EligibilityBlock[];
  request: EligibilityRequest;
}): boolean {
  const { aircraft, rangeNm, blocks, request } = input;
  if (!aircraft.is_active) return false;
  if (aircraft.seating < request.passengers) return false;
  if (request.distanceNm * RANGE_MARGIN > rangeNm) return false;
  if (request.pets && !aircraft.pets) return false;
  if (request.wifi_preferred && !aircraft.wifi) return false;
  if (request.golf && !aircraft.golf) return false;
  if (request.skis && !aircraft.skis) return false;
  if (request.baggage && !(Number(aircraft.baggage_cu_ft ?? 0) > 0)) return false;

  const depart = request.departAt;
  const blocked = blocks.some((block) => {
    if (block.aircraft_id !== aircraft.id) return false;
    const start = new Date(block.starts_at);
    const end = new Date(block.ends_at);
    return depart >= start && depart <= end;
  });
  return !blocked;
}
