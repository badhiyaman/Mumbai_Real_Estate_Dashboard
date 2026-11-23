// Small builders for tests: a project with sensible empty defaults.
import type { PricePoint, Project, RentalPoint } from "./types";

let id = 1;

export function price(date: string, psf: number, extra: Partial<PricePoint> = {}): PricePoint {
  return {
    id: id++,
    date,
    date_precision: "month",
    stage: "resale",
    price_psf: psf,
    basis: "carpet",
    source_name: "test",
    source_url: "https://example.com",
    confidence: "high",
    note: null,
    ...extra,
  };
}

export function rent(date: string, monthly: number, sqft: number, extra: Partial<RentalPoint> = {}): RentalPoint {
  return {
    id: id++,
    date,
    config: "3 BHK",
    carpet_sqft: sqft,
    monthly_rent: monthly,
    furnishing: "unknown",
    kind: "asking",
    source_name: "test",
    source_url: "https://example.com",
    confidence: "low",
    note: null,
    ...extra,
  };
}

export function project(extra: Partial<Project> = {}): Project {
  const slug = extra.slug ?? `p${id++}`;
  return {
    id: id++,
    slug,
    name: slug,
    address: null,
    lat: null,
    lng: null,
    land_acres: null,
    towers: null,
    floors_max: null,
    total_units: null,
    rera_ids: [],
    status: "completed",
    launch_date: null,
    possession_promised: null,
    possession_actual: null,
    amenities: [],
    description: null,
    image_url: null,
    notes: null,
    sources: [],
    architect: null,
    contractor: null,
    branded_residence: null,
    flats_per_floor: null,
    lifts_per_tower: null,
    ceiling_height_ft: null,
    car_parks_per_unit: null,
    clubhouse_sqft: null,
    open_space_pct: null,
    green_certification: null,
    views: [],
    land_type: null,
    land_tenure: null,
    jv_partner: null,
    oc_received: null,
    oc_date: null,
    rera_complaints: null,
    units_sold: null,
    units_sold_as_of: null,
    loading_pct: null,
    floor_rise_psf: null,
    floor_rise_notes: null,
    maintenance_psf_month: null,
    payment_plan: null,
    transactions_12m: null,
    nearest_metro: null,
    nearest_metro_km: null,
    distance_bkc_km: null,
    distance_airport_km: null,
    developer: null,
    micro_market: null,
    unit_types: [],
    price_points: [],
    rental_points: [],
    ...extra,
  };
}
