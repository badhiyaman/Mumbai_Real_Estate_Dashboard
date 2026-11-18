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
  listed_ticker?: string; // e.g. "NSE: LODHA"; listed developers publish audited sales data
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
  typical_rent_yield_pct?: number; // gross yearly rent ÷ price, as %, from a cited report
  rent_yield_source_url?: string;
  notes?: string;
}

export interface SeedUnitType {
  config: string;
  carpet_sqft_min?: number;
  carpet_sqft_max?: number;
  price_min_cr?: number;
  price_max_cr?: number;
  units?: number; // how many apartments of this type exist
  notes?: string;
}

/** A monthly rent asked or achieved for one apartment. */
export interface SeedRentalPoint {
  date: string; // YYYY-MM-DD
  config: string; // e.g. "3 BHK"
  carpet_sqft?: number;
  monthly_rent: number; // rupees per month
  furnishing: "furnished" | "semi_furnished" | "unfurnished" | "unknown";
  kind: "asking" | "registered"; // listing vs registered leave-and-licence deal
  source_name: string;
  source_url: string;
  confidence: Confidence;
  note?: string;
}

export type LandType = "private" | "mill_land" | "redevelopment" | "sra" | "government_lease" | "other";

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

/** General costs of buying, holding, renting out and selling in Mumbai (data/seed/reference/costs.json). */
export interface SeedCostItem {
  key: string; // e.g. "stamp_duty", "gst_under_construction"
  name: string; // plain-English label
  stage: "buying" | "holding" | "renting" | "selling";
  value: string; // e.g. "6% of agreement value (5% + 1% metro cess)"
  rate_pct?: number; // numeric rate when there is one
  applies_to?: string; // e.g. "Under-construction homes without OC"
  as_of: string; // YYYY-MM-DD the rule was checked
  source_name: string;
  source_url: string;
  note?: string;
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

  // --- Building & specs ---
  architect?: string;
  contractor?: string; // main construction contractor, e.g. L&T, Shapoorji
  branded_residence?: string; // e.g. "Trump", "Four Seasons", "Armani/Casa"
  flats_per_floor?: number; // per tower, typical floor (privacy indicator)
  lifts_per_tower?: number;
  ceiling_height_ft?: number; // floor-to-ceiling in typical apartments
  car_parks_per_unit?: number; // typical allotment
  clubhouse_sqft?: number;
  open_space_pct?: number; // % of land that is open / landscaped
  green_certification?: string; // e.g. "IGBC Gold"
  views?: string[]; // e.g. ["sea", "racecourse", "city", "golf course"]

  // --- Land & approvals ---
  land_type?: LandType;
  land_tenure?: "freehold" | "leasehold" | "unknown";
  jv_partner?: string; // landowner / joint-venture partner
  oc_received?: boolean; // occupation certificate
  oc_date?: string; // YYYY-MM-DD
  rera_complaints?: number; // count of MahaRERA complaints found
  units_sold?: number;
  units_sold_as_of?: string; // YYYY-MM-DD

  // --- Pricing details ---
  loading_pct?: number; // saleable ÷ carpet − 1, as %, e.g. 35 means saleable is 35% bigger than carpet
  floor_rise_psf?: number; // extra ₹ per sq ft for each floor up
  floor_rise_notes?: string; // e.g. "₹500/sq ft per floor above 20th; sea-view premium 10%"
  maintenance_psf_month?: number; // ₹ per sq ft (carpet) per month
  payment_plan?: string; // e.g. "20:80", "construction-linked", "10:90 subvention"
  transactions_12m?: number; // registered sales in the last 12 months (liquidity)

  // --- Location ---
  nearest_metro?: string;
  nearest_metro_km?: number;
  distance_bkc_km?: number;
  distance_airport_km?: number; // to Mumbai T2

  unit_types: SeedUnitType[];
  price_points: SeedPricePoint[];
  rental_points?: SeedRentalPoint[];
  news: SeedNews[];
}
