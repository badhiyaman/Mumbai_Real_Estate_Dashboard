import {
  configBucket,
  growth,
  latestPrice,
  launchYear,
  minTicketCr,
  possessionLabel,
  rentalYields,
  shortName,
  typicalYield,
} from "./metrics";
import type { Project } from "./types";

/** Small, precomputed summary of a project for gallery cards and filters. */
export interface ProjectCard {
  slug: string;
  name: string;
  developer: string;
  developerSlug: string;
  area: string;
  areaSlug: string;
  region: string;
  status: Project["status"];
  launchYear: number | null;
  landAcres: number | null;
  imageUrl: string | null;
  configs: string[];
  minTicketCr: number | null;
  latestPsf: number | null;
  latestBasis: string | null;
  totalGrowth: number | null;
  cagr: number | null;
  growthYears: number | null;
  pricePoints: number;
  rentYield: number | null; // median gross yield
  views: string[];
  possession: string | null; // "On time", "14 months late", "Due Mar 2028"
  floors: number | null;
}

export function toCard(p: Project): ProjectCard {
  const g = growth(p.price_points);
  // Use the point growth ends on, so "latest price" and "growth" on a card agree.
  const last = g?.last ?? latestPrice(p.price_points);
  return {
    slug: p.slug,
    name: p.name,
    developer: p.developer ? shortName(p.developer.name) : "Unknown",
    developerSlug: p.developer?.slug ?? "",
    area: p.micro_market?.name ?? "Mumbai",
    areaSlug: p.micro_market?.slug ?? "",
    region: p.micro_market?.region ?? "",
    status: p.status,
    launchYear: launchYear(p),
    landAcres: p.land_acres,
    imageUrl: p.image_url,
    configs: [...new Set(p.unit_types.map((u) => configBucket(u.config)).filter((c) => c !== "Other"))],
    minTicketCr: minTicketCr(p.unit_types),
    latestPsf: last?.price_psf ?? null,
    latestBasis: last?.basis ?? null,
    totalGrowth: g?.totalPct ?? null,
    cagr: g?.cagr ?? null,
    growthYears: g?.years ?? null,
    pricePoints: p.price_points.length,
    rentYield: typicalYield(rentalYields(p)),
    views: p.views ?? [],
    possession: possessionLabel(p),
    floors: p.floors_max,
  };
}
