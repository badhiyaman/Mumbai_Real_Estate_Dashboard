// Shape of the JSON files in data/seed/. The seed script loads these into Supabase.

export type Confidence = "high" | "medium" | "low";
export type Stage = "pre_launch" | "launch" | "under_construction" | "completion" | "resale";
export type ProjectStatus = "completed" | "under_construction" | "upcoming";
export type NewsEventType =
  | "launch"
  | "price_hike"
  | "deal"
  | "delay"
  | "litigation"
  | "possession"
  | "rera"
  | "redevelopment"
  | "other";

export interface SeedDeveloper {
  slug: string;
  name: string;
  founded_year?: number;
  projects_delivered?: number;
  delivery_track_record?: string;
  on_time_score?: number; // 0-100
  website?: string;
  notes?: string;
}

export interface SeedCatalyst {
  name: string;
  type: "metro" | "road" | "rail" | "airport" | "commercial" | "other";
  status: "operational" | "under_construction" | "planned";
  expected_year?: number;
  source_url?: string;
}

export interface SeedMicroMarket {
  slug: string;
  name: string;
  region: string;
  lat?: number;
  lng?: number;
  catalysts: SeedCatalyst[];
  notes?: string;
}

export interface SeedUnitType {
  config: string;
  carpet_sqft_min?: number;
  carpet_sqft_max?: number;
  price_min_cr?: number;
  price_max_cr?: number;
  notes?: string;
}

export interface SeedPricePoint {
  date: string; // YYYY-MM-DD (use 01 for unknown day / month)
  date_precision: "day" | "month" | "year";
  stage: Stage;
  price_psf: number; // rupees per sq ft
  basis: "carpet" | "saleable" | "unknown";
  source_name: string;
  source_url: string;
  confidence: Confidence;
  note?: string;
}

export interface SeedNews {
  date: string; // YYYY-MM-DD
  title: string;
  url: string;
  source: string;
  event_type: NewsEventType;
  summary?: string;
}

export interface SeedProject {
  slug: string;
  name: string;
  developer: string; // developer slug
  micro_market: string; // micro_market slug
  address?: string;
  lat?: number;
  lng?: number;
  land_acres?: number;
  towers?: number;
  floors_max?: number;
  total_units?: number;
  rera_ids: string[];
  status: ProjectStatus;
  launch_date?: string;
  possession_promised?: string;
  possession_actual?: string;
  amenities: string[];
  description?: string;
  image_url?: string;
  notes?: string;
  sources: string[];
  unit_types: SeedUnitType[];
  price_points: SeedPricePoint[];
  news: SeedNews[];
}
