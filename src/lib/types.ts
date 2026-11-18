import type { Confidence, NewsEventType, ProjectStatus, SeedCatalyst, Stage } from "./seed-types";

export interface Developer {
  id: number;
  slug: string;
  name: string;
  founded_year: number | null;
  projects_delivered: number | null;
  delivery_track_record: string | null;
  on_time_score: number | null;
  website: string | null;
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
  notes: string | null;
}

export interface UnitType {
  id: number;
  config: string;
  carpet_sqft_min: number | null;
  carpet_sqft_max: number | null;
  price_min_cr: number | null;
  price_max_cr: number | null;
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
  developer: Developer | null;
  micro_market: MicroMarket | null;
  unit_types: UnitType[];
  price_points: PricePoint[];
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
