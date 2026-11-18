import { growth, latestPrice, launchYear, minTicketCr } from "./metrics";
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
}

export function toCard(p: Project): ProjectCard {
  const g = growth(p.price_points);
  const last = latestPrice(p.price_points);
  return {
    slug: p.slug,
    name: p.name,
    developer: p.developer?.name ?? "Unknown",
    developerSlug: p.developer?.slug ?? "",
    area: p.micro_market?.name ?? "Mumbai",
    areaSlug: p.micro_market?.slug ?? "",
    region: p.micro_market?.region ?? "",
    status: p.status,
    launchYear: launchYear(p),
    landAcres: p.land_acres,
    imageUrl: p.image_url,
    configs: [...new Set(p.unit_types.map((u) => u.config))],
    minTicketCr: minTicketCr(p.unit_types),
    latestPsf: last?.price_psf ?? null,
    latestBasis: last?.basis ?? null,
    totalGrowth: g?.totalPct ?? null,
    cagr: g?.cagr ?? null,
    growthYears: g?.years ?? null,
    pricePoints: p.price_points.length,
  };
}
