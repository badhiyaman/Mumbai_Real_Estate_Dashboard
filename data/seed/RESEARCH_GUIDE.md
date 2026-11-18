# Research guide for project seed data

Use this guide when adding or enriching projects in `data/seed/`. The dashboard is educational: it shows how Mumbai luxury
(₹5 Cr+) projects have been priced over time. **Accuracy and sourcing come before completeness.**

## Rules
1. **Never invent or estimate a number without a source.** If you can't find it, leave the field out.
2. Every price point and rental point needs a real `source_url`. Every news item needs a real article URL.
3. When you compute a figure yourself (e.g. deal value ÷ area), say so in `note`.
4. Confidence: `high` = registered transaction (IGR data via Zapkey/Propstack/Square Yards news) or official/audited
   (MahaRERA, developer investor presentation); `medium` = reputable news quote; `low` = listing asking price or vague quote.
5. Area basis matters: record `carpet`, `saleable` (also called built-up/super built-up), or `unknown`. Don't convert.
6. Where sources disagree, pick the best-sourced value and record the others in `notes`.
7. Dates are `YYYY-MM-DD`. Use `-01` for an unknown day or month, and set `date_precision` on price points.
8. Reuse existing slugs in `data/seed/developers.json` and `data/seed/micro_markets.json`. Only create a new slug
   (lowercase-hyphenated) when the developer or area isn't there yet.
9. Check `data/seed/projects/` first: never overwrite a project file someone else wrote, unless you were asked to enrich it.
10. After writing, check every file parses:
    `node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" <file>`

## Format
Match the TypeScript interfaces in `src/lib/seed-types.ts` exactly (`SeedProject`, `SeedDeveloper`, `SeedMicroMarket`,
`SeedRentalPoint`, `SeedCostItem`). One file per project: `data/seed/projects/<slug>.json`. New developers and
micro-markets go in `data/seed/_research/<batch-name>.json` as `{ "developers": [...], "micro_markets": [...] }`.

## What to collect for each project
- **Basics:** address, approximate lat/lng, status, launch date, promised and actual possession, MahaRERA IDs, description.
- **Building:** land parcel (acres), towers, max floors, total units, flats per floor, lifts per tower, ceiling height,
  car parks per unit, clubhouse size, open space %, architect, main contractor, green certification, branded tie-up,
  views (sea, racecourse, city, golf course).
- **Land & approvals:** land type (private, mill land, redevelopment, SRA, government lease), freehold/leasehold,
  JV or landowner partner, OC received and date, units sold with an as-of date (MahaRERA), MahaRERA complaints.
- **Apartment types:** configuration, carpet area range, ticket size range, number of units of each type.
- **Price history (₹/sq ft):** pre-launch, launch, mid-construction changes, completion, today's resale. Registered
  deals are best; also look in listed developers' investor presentations (Oberoi, Lodha/Macrotech, Godrej, Sunteck,
  Kalpataru, Keystone/Rustomjee) for project-level realisations.
- **Pricing details:** loading % (saleable vs carpet), floor-rise charge (₹/sq ft per floor) and view premiums,
  maintenance (₹/sq ft/month), payment plan (e.g. 20:80, construction-linked), registered sales in the last 12 months.
- **Rent:** 2–5 rental points (monthly rent, config, carpet area, furnishing, asking vs registered) from listing sites
  (99acres, MagicBricks, Housing.com, NoBroker, Square Yards) or news. These let the app compute rental yield.
- **Location:** nearest metro station and distance, distance to BKC and to the airport (T2), by road.
- **News (3–8 items):** launch, price hikes, record deals, delays, litigation, possession, RERA actions.
- **Amenities and notes:** amenities list; notes on litigation, delays, redevelopment, notable buyers, anything an
  investor should know.

## Good sources
MahaRERA (maharera.maharashtra.gov.in), developer websites and investor presentations (BSE/NSE filings),
ET Realty / Economic Times, Moneycontrol, Mint, Business Standard, Hindustan Times, Mid-day, Free Press Journal,
Zapkey / Propstack / Square Yards (IGR data), Anarock, Knight Frank, JLL, PropEquity, 99acres, MagicBricks, Housing.com.
