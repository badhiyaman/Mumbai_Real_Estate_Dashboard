import type { Confidence, LandType, NewsEventType, ProjectStatus, SeedCatalyst, Stage } from "./seed-types";

export interface Developer {
  id: number;
  slug: string;
  name: string;
  founded_year: number | null;
  projects_delivered: number | null;
  delivery_track_record: string | null;
  on_time_score: number | null;
  website: string | null;
  listed_ticker: string | null;
  notes: string | null;
}

export interface MicroMarket {
  id: number;
  slug: string;
  name: string;
  region: string | null;
  lat: number | null;
  lng: number | null;
  catalysts: SeedCatalyst[];
  typical_rent_yield_pct: number | null;
  rent_yield_source_url: string | null;
  notes: string | null;
}

export interface UnitType {
  id: number;
  config: string;
  carpet_sqft_min: number | null;
  carpet_sqft_max: number | null;
  price_min_cr: number | null;
  price_max_cr: number | null;
  units: number | null;
  notes: string | null;
}

export interface PricePoint {
  id: number;
  date: string;
  date_precision: "day" | "month" | "year";
  stage: Stage;
  price_psf: number;
  basis: "carpet" | "saleable" | "unknown";
  source_name: string | null;
  source_url: string | null;
  confidence: Confidence;
  note: string | null;
}

export interface Project {
  id: number;
  slug: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  land_acres: number | null;
  towers: number | null;
  floors_max: number | null;
  total_units: number | null;
  rera_ids: string[];
  status: ProjectStatus;
  launch_date: string | null;
  possession_promised: string | null;
  possession_actual: string | null;
  amenities: string[];
  description: string | null;
  image_url: string | null;
  notes: string | null;
  sources: string[];

  architect: string | null;
  contractor: string | null;
  branded_residence: string | null;
  flats_per_floor: number | null;
  lifts_per_tower: number | null;
  ceiling_height_ft: number | null;
  car_parks_per_unit: number | null;
  clubhouse_sqft: number | null;
  open_space_pct: number | null;
  green_certification: string | null;
  views: string[];
  land_type: LandType | null;
  land_tenure: "freehold" | "leasehold" | "unknown" | null;
  jv_partner: string | null;
  oc_received: boolean | null;
  oc_date: string | null;
  rera_complaints: number | null;
  units_sold: number | null;
  units_sold_as_of: string | null;
  loading_pct: number | null;
  floor_rise_psf: number | null;
  floor_rise_notes: string | null;
  maintenance_psf_month: number | null;
  payment_plan: string | null;
  transactions_12m: number | null;
  nearest_metro: string | null;
  nearest_metro_km: number | null;
  distance_bkc_km: number | null;
  distance_airport_km: number | null;

  developer: Developer | null;
  micro_market: MicroMarket | null;
  unit_types: UnitType[];
  price_points: PricePoint[];
  rental_points: RentalPoint[];
}

export interface RentalPoint {
  id: number;
  date: string;
  config: string;
  carpet_sqft: number | null;
  monthly_rent: number;
  furnishing: "furnished" | "semi_furnished" | "unfurnished" | "unknown";
  kind: "asking" | "registered";
  source_name: string | null;
  source_url: string | null;
  confidence: Confidence;
  note: string | null;
}

export interface CostItem {
  key: string;
  name: string;
  stage: "buying" | "holding" | "renting" | "selling";
  value: string;
  rate_pct: number | null;
  applies_to: string | null;
  as_of: string;
  source_name: string | null;
  source_url: string | null;
  note: string | null;
}

export interface ProjectNewsItem {
  event_type: NewsEventType | null;
  origin: "research" | "auto";
  article: {
    id: number;
    url: string;
    title: string;
    source: string | null;
    published_at: string | null;
    snippet: string | null;
  };
}
