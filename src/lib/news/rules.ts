// Pure rules for the news job: which stories count as Mumbai real estate, and how to tag them.
// No network or database code here, so it's easy to test.

/** Sources the daily job reads. Google News searches are the most reliable; the rest are extra coverage. */
const gnews = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:7d`)}&hl=en-IN&gl=IN&ceid=IN:en`;

/** `general: true` = a city-wide feed, where a real estate word must appear in the headline itself. */
export const FEEDS: { name: string; url: string; general?: boolean }[] = [
  { name: "Google News: Mumbai real estate", url: gnews('"Mumbai" real estate') },
  { name: "Google News: Mumbai property prices", url: gnews("Mumbai property prices") },
  { name: "Google News: Mumbai luxury deals", url: gnews("Mumbai luxury apartment crore") },
  { name: "Google News: MahaRERA", url: gnews("MahaRERA") },
  { name: "Google News: Mumbai redevelopment", url: gnews("Mumbai redevelopment housing") },
  { name: "Google News: Mumbai housing sales", url: gnews("Mumbai housing sales Anarock OR Knight Frank OR PropEquity") },
  { name: "Google News: Mumbai infrastructure", url: gnews("Mumbai metro OR coastal road OR Atal Setu real estate") },
  { name: "ET Realty", url: "https://realty.economictimes.indiatimes.com/rss/topstories" },
  { name: "Hindustan Times Mumbai", url: "https://www.hindustantimes.com/feeds/rss/cities/mumbai-news/rssfeed.xml", general: true },
  { name: "Moneycontrol Real Estate", url: "https://www.moneycontrol.com/rss/realestate.xml" },
  { name: "Free Press Journal Mumbai", url: "https://www.freepressjournal.in/stories.rss?section=mumbai", general: true },
];

const MUMBAI_WORDS = [
  "mumbai", "mmr", "maharashtra", "thane", "navi mumbai", "bkc", "bandra-kurla", "maharera", "bmc", "mhada", "cidco",
  "sra", "south bombay", "bombay",
];

/** Other cities whose stories mention MahaRERA or Maharashtra but aren't about Mumbai/MMR. */
const OTHER_CITIES = [
  "pune", "punawale", "pimpri", "chinchwad", "hinjewadi", "wakad", "kharadi", "nagpur", "nashik", "aurangabad",
  "chhatrapati sambhajinagar", "kolhapur", "solapur", "dubai", "bengaluru", "bangalore", "gurugram", "gurgaon",
  "noida", "delhi", "hyderabad", "chennai", "kolkata", "goa",
];

/** Mumbai/MMR place words specific enough to count on their own (unlike "Maharashtra" or "MahaRERA"). */
const MUMBAI_SPECIFIC = ["mumbai", "mmr", "thane", "navi mumbai", "bkc", "bombay", "south bombay"];

const REAL_ESTATE_WORDS = [
  "real estate", "realty", "property", "properties", "housing", "home sales", "homebuyer", "home buyer", "apartment",
  "flat", "flats", "penthouse", "duplex", "residential", "luxury home", "redevelopment", "rera", "stamp duty",
  "developer", "builder", "sq ft", "sq. ft", "square feet", "land parcel", "land deal", "acre", "home loan",
  "office space", "leasing", "rental", "rent", "township", "tower", "housing society", "fsi",
];

/** Lowercased, punctuation-light text for matching. */
export const norm = (s: string) => ` ${s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9₹.&/ -]+/g, " ").replace(/\s+/g, " ")} `;

const hasWord = (text: string, w: string) => text.includes(` ${w} `) || text.includes(` ${w}s `) || text.includes(` ${w},`);

/**
 * Does a story look like Mumbai real estate news? It needs a Mumbai/MMR place word and a real estate
 * word. For city-wide feeds (`general`), the real estate word must be in the headline, so fires and
 * traffic stories that merely mention a building don't get in. Stories led by another city (e.g.
 * Pune MahaRERA orders) are left out unless the headline also names a specific Mumbai place.
 */
export function isRelevant(
  title: string,
  snippet: string,
  extraPlaces: string[] = [],
  { general = false }: { general?: boolean } = {},
): boolean {
  const t = norm(`${title} ${snippet}`);
  const head = norm(title);
  const extra = extraPlaces.map((p) => p.toLowerCase());
  const place = [...MUMBAI_WORDS, ...extra].some((w) => hasWord(t, w));
  const re = REAL_ESTATE_WORDS.some((w) => hasWord(general ? head : t, w));
  if (!place || !re) return false;
  const otherCity = OTHER_CITIES.some((c) => hasWord(head, c));
  const mumbaiInHead = [...MUMBAI_SPECIFIC, ...extra].some((w) => hasWord(head, w));
  return !(otherCity && !mumbaiInHead);
}

export const TOPICS: Record<string, { label: string; words: string[] }> = {
  deal: { label: "Deals & leases", words: ["buys", "bought", "sells", "sold", "purchases", "acquires", "deal", "transaction", "crore apartment", "crore flat", "leases", "leased", "rents", "rental"] },
  launch: { label: "New launch", words: ["launch", "launches", "launched", "unveils", "new project", "pre-launch", "township", "to develop", "plans"] },
  market: { label: "Market & prices", words: ["sales", "prices", "price", "report", "quarter", "anarock", "knight frank", "propequity", "jll", "cbre", "inventory", "registrations", "demand", "luxury housing", "premium housing"] },
  policy: { label: "Policy & tax", words: ["stamp duty", "gst", "policy", "government", "dcpr", "fsi", "ready reckoner", "tax", "budget", "regulation", "rera", "maharera"] },
  rates: { label: "Interest rates", words: ["rbi", "repo", "home loan", "interest rate", "emi"] },
  infra: { label: "Infrastructure", words: ["metro", "coastal road", "atal setu", "mthl", "airport", "sea link", "bullet train", "connector", "flyover", "expressway"] },
  redevelopment: { label: "Redevelopment", words: ["redevelopment", "redevelop", "slum", "sra", "cluster", "society"] },
  legal: { label: "Legal & disputes", words: ["court", "tribunal", "complaint", "fraud", " ed ", "cbi", "insolvency", "nclt", "arrested", "probe", "refund"] },
};

export function topicsFor(title: string, snippet: string): string[] {
  const t = norm(`${title} ${snippet}`);
  return Object.entries(TOPICS)
    .filter(([, v]) => v.words.some((w) => (w.startsWith(" ") ? t.includes(w) : hasWord(t, w))))
    .map(([k]) => k);
}

export interface NameIndex {
  slug: string;
  names: string[]; // lowercased names/aliases to look for
}

/** Slugs whose names appear in the text. Names shorter than 4 characters are ignored to avoid false matches. */
export function matchNames(title: string, snippet: string, index: NameIndex[]): string[] {
  const t = norm(`${title} ${snippet}`);
  return index.filter((i) => i.names.some((n) => n.length >= 4 && t.includes(` ${n} `))).map((i) => i.slug);
}

/** Aliases for a project: its name, its name without the developer prefix, and the part before any brackets. */
export function projectAliases(name: string, developerName?: string | null): string[] {
  const base = name.replace(/\s*\(.*?\)\s*/g, " ").replace(/,.*$/, "").trim().toLowerCase();
  const out = new Set([base]);
  const devWord = developerName?.split(/\s+/)[0]?.toLowerCase();
  if (devWord && base.startsWith(devWord + " ")) {
    const rest = base.slice(devWord.length + 1);
    // Only keep the short form if it's distinctive (e.g. "world towers", not "park").
    if (rest.split(" ").length >= 2 || rest.length >= 8) out.add(rest);
  }
  return [...out].map((s) => norm(s).trim());
}

/** "Lodha Developers (Macrotech Developers Ltd)" → ["lodha developers", "lodha", "macrotech developers"] */
export function developerAliases(name: string): string[] {
  const main = name.replace(/\s*\(.*\)\s*$/, "").trim();
  const inner = name.match(/\((.*)\)/)?.[1] ?? "";
  const strip = (s: string) => s.replace(/\b(ltd|limited|pvt|private|group|corp|corporation|realty|realtors|developers|properties|estates)\b\.?/gi, "").trim();
  const set = new Set([main, strip(main), inner.split(/[,;]/)[0], strip(inner.split(/[,;]/)[0] ?? "")].map((s) => norm(s).trim()).filter(Boolean));
  return [...set];
}

/** Normalised title used to spot the same story syndicated across outlets. */
export function titleKey(title: string): string {
  return norm(title.replace(/\s+-\s+[^-]+$/, "")) // drop " - Source" suffix (Google News)
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 12)
    .join(" ");
}

const STOP = new Set(
  "the and for with from that this into over after amid says said will have has its are was were new more than about mumbai mumbais crore lakh flat flats apartment apartments property properties real estate housing homes home report maharera orders order within days months years bombay high court says".split(" "),
);

/** Distinctive words of a headline, for spotting the same story told by several outlets. */
export function headlineWords(title: string): Set<string> {
  return new Set(
    norm(title.replace(/\s+[-|]\s+[^-|]+$/, ""))
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  );
}

/** Same story? Shares 3+ distinctive words, or 2+ that make up most of the shorter headline. */
export function sameStory(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const smaller = Math.min(a.size, b.size) || 1;
  return shared >= 3 || (shared >= 2 && shared / smaller >= 0.6);
}

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
