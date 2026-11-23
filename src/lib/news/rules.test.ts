import { describe, expect, it } from "vitest";
import {
  developerAliases,
  headlineWords,
  isRelevant,
  matchNames,
  projectAliases,
  sameStory,
  titleKey,
  topicsFor,
} from "./rules";

describe("isRelevant", () => {
  it("keeps Mumbai real estate stories", () => {
    expect(isRelevant("Aamir Khan leases three Mumbai apartments for ₹38 lakh a month", "")).toBe(true);
    expect(isRelevant("Keystone Realtors to launch ₹5K cr housing in MMR", "")).toBe(true);
  });
  it("drops real estate stories from other cities, even with MahaRERA in them", () => {
    expect(isRelevant("MahaRERA Orders Vedanta Buildcon to Hand Over Pune Flat", "")).toBe(false);
    expect(isRelevant("Dubai property prices rise", "")).toBe(false);
  });
  it("keeps a story that names Mumbai alongside another city", () => {
    expect(isRelevant("Is Dubai property cheaper than Mumbai?", "")).toBe(true);
  });
  it("drops Mumbai stories that aren't about real estate", () => {
    expect(isRelevant("Mumbai local trains delayed by rain", "")).toBe(false);
  });
  it("for city-wide feeds, needs real estate in the headline, not just the summary", () => {
    const fire = "Eight rescued as fire breaks out in Mumbai Central building";
    const snippet = "Residents of the residential tower were evacuated from flats";
    expect(isRelevant(fire, snippet, [], { general: true })).toBe(false);
    expect(isRelevant(fire, snippet)).toBe(true); // a targeted real estate feed would keep it
  });
  it("counts area names from the database as Mumbai places", () => {
    expect(isRelevant("Worli apartment sold for ₹100 crore", "", [])).toBe(false);
    expect(isRelevant("Worli apartment sold for ₹100 crore", "", ["worli"])).toBe(true);
  });
});

describe("tagging", () => {
  it("assigns topics from keywords", () => {
    expect(topicsFor("RBI keeps repo rate unchanged; home loan EMIs stay", "")).toContain("rates");
    expect(topicsFor("Actor buys sea-facing duplex in Worli", "")).toContain("deal");
  });
  it("matches project names, including without the developer prefix", () => {
    const index = [{ slug: "lodha-world-towers", names: projectAliases("Lodha The World Towers", "Lodha Developers") }];
    expect(matchNames("Flat in The World Towers sold for ₹40 crore", "", index)).toEqual(["lodha-world-towers"]);
  });
  it("matches developer short names", () => {
    const names = developerAliases("Lodha Developers (Macrotech Developers Ltd)");
    expect(names).toContain("lodha");
    expect(names).toContain("macrotech");
  });
});

describe("grouping repeats", () => {
  it("treats the same story from two outlets as one", () => {
    const a = headlineWords("Aamir Khan leases three Mumbai apartments for ₹38 lakh a month");
    const b = headlineWords("Aamir Khan leases 3 luxury apartments in Santacruz for Rs 38 lakh monthly rent - Hindustan Times");
    expect(sameStory(a, b)).toBe(true);
  });
  it("keeps different MahaRERA rulings apart", () => {
    const a = headlineWords("MahaRERA Orders Vasai Flat Handover Within 60 Days");
    const b = headlineWords("MahaRERA Orders Ganga Utopia Duplex Handover");
    expect(sameStory(a, b)).toBe(false);
  });
  it("title keys ignore the Google News outlet suffix", () => {
    expect(titleKey("Big deal in Worli - Hindustan Times")).toBe(titleKey("Big deal in Worli"));
  });
});
