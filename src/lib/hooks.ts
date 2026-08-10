/**
 * Hook patterns reverse-engineered from ads actually running in the AI-training
 * niche, pulled from the Meta Ad Library (UK, sorted by total impressions,
 * August 2026, ~2,700 results in the set).
 *
 * A word on method, because it matters for how much to trust this file.
 * Nobody outside an ad account can see its performance. What the Ad Library
 * does expose is *longevity* and *variant count*, and those are the best
 * available proxies: advertisers kill losers fast, and they only build twelve
 * variants of a creative that is already paying. Every pattern below cleared
 * both bars. That is evidence, not proof — treat the ranking as a prior to
 * test against, which is exactly what the phase machine does with it.
 *
 * These are structures, not copy. The wording is ours; what is borrowed is the
 * shape — which is the transferable part anyway, since a competitor's sentence
 * sells a competitor's product.
 */

export interface HookPattern {
  id: string;
  name: string;
  /** The mechanism, in one line, for the copywriter. */
  structure: string;
  /** Why it works — the psychology, not the vibe. */
  why: string;
  /** Observed in the wild, paraphrased. */
  observed: string;
  /** How it maps onto Light School specifically. */
  forLightSchool: string;
  /** Longevity + variant evidence backing it. */
  evidence: string;
}

export const HOOK_PATTERNS: HookPattern[] = [
  {
    id: "audience-callout",
    name: "Audience call-out first",
    structure:
      "Open by naming the reader's role, then a dash, then the claim. The first three words disqualify everyone else.",
    why: "In a feed, relevance beats cleverness. Naming the role does the targeting the algorithm cannot, and the reader self-selects before the scroll completes.",
    observed:
      "Synthesia opens dozens of variants with 'Training folks -' and 'if you work in L&D'.",
    forLightSchool:
      "'Ops leads -', 'If you run a marketing team -', 'Agency owners -'. Light School's audiences are far more specific than 'businesses'.",
    evidence: "Synthesia: 20+ live variants, continuous since 22 Jun 2026.",
  },
  {
    id: "category-negation",
    name: "Negate the category, not the competitor",
    structure:
      "Name the thing the reader already does and dismiss it, then offer the replacement. 'Forget X. Here is what happens instead.'",
    why: "Attacks a habit rather than a rival, so it never reads as a swipe and cannot be rebutted. It also pre-frames the offer as a category change, which sidesteps feature comparison.",
    observed:
      "'forget boring PowerPoints', 'Forget about cameras and actors', 'Most courses use fake tools to teach and call it training'.",
    forLightSchool:
      "The strongest available: 'Forget the AI webinar your team will not finish.' Light School's real differentiator is that people leave with a working thing.",
    evidence:
      "Used by both Synthesia and CodeRed — the two highest-impression advertisers in the set.",
  },
  {
    id: "three-step-mechanism",
    name: "Numbered three-step mechanism",
    structure:
      "Show the whole process as exactly three numbered steps. Never four. Never prose.",
    why: "Converts an abstract promise into something the reader can picture themselves completing. Three reads as easy; five reads as a project.",
    observed:
      "'1. Upload a PowerPoint 2. Type in your script 3. Press Generate video' — repeated near-verbatim across most Synthesia variants.",
    forLightSchool:
      "'1. Bring a problem your team actually has. 2. Build the thing in the session. 3. Leave with it running.'",
    evidence:
      "The single most repeated structure in the entire result set.",
  },
  {
    id: "objection-parallel",
    name: "Objection handled in parallel structure",
    structure:
      "Two or three lines of 'Need to X? Simply Y.' Same rhythm each time, one objection per line.",
    why: "Answers the doubts in the order they arrive without ever conceding they are problems. The repetition makes the product feel systematically easy rather than defensively justified.",
    observed:
      "'Need to update the video? Simply change the text. Need to localize? Simply select a language.'",
    forLightSchool:
      "'Nobody on the team codes? That is the point. Everyone is busy? It is one afternoon.'",
    evidence: "Present in nearly every long-running Synthesia variant.",
  },
  {
    id: "proof-by-specificity",
    name: "Proof by naming real things",
    structure:
      "Replace the adjective with the proper noun. Not 'real tools' — name the tools. Not 'saved money' — name the amount.",
    why: "Specificity is unfakeable in a way that superlatives are not. A reader cannot verify 'industry-leading' but instantly believes a named tool and a real number.",
    observed:
      "CodeRed names 'PyRIT, crAPI, Burp, Kali' rather than saying 'industry-standard tools'.",
    forLightSchool:
      "Light School has better raw material than anyone in this set: the $800/month SaaS tool a student replaced, the booking system, the Monday report.",
    evidence: "CodeRed: 6 ads on one creative, running since 3 Jul 2026.",
  },
  {
    id: "social-proof-ps",
    name: "Social proof as a P.S.",
    structure:
      "End with 'P.S.' and one hard number. Never open with it.",
    why: "A P.S. is read at a higher rate than body copy, and proof lands better after the pitch than before it — by then the reader is looking for permission, not persuasion.",
    observed:
      "'P.S. Synthesia is used by 50,000 teams and rated 4.7/5 ⭐' closes almost every variant.",
    forLightSchool:
      "'P.S. More than 1,300 people have been through this. Every one left with something running.'",
    evidence: "Universal across the highest-impression advertiser in the set.",
  },
  {
    id: "cost-of-inaction",
    name: "Price the status quo",
    structure:
      "Put a number on what continuing to do nothing costs — in money, or in hours per week.",
    why: "Reframes the purchase as recovering an existing loss rather than adding a new expense. Loss aversion does the work.",
    observed:
      "CodeRed anchors '$79 instead of $399'; the career ads anchor '£25k–£35k' against '£50k–£65k+'.",
    forLightSchool:
      "'Someone on your team spends six hours a week moving numbers between spreadsheets.' Team training is the offer where this is strongest — the buyer already pays the cost in salary.",
    evidence: "Both CodeRed and Transform Learning Academy, sustained runs.",
  },
  {
    id: "time-stamp",
    name: "Stamp the year",
    structure: "'It's 2026, and you are still doing X.'",
    why: "Manufactures obsolescence without insulting the reader. The implied judgment is on the method, not on them.",
    observed: "'👉 Training folks - it's 2026, forget boring PowerPoints.'",
    forLightSchool:
      "Use sparingly — it is the most imitated line in the niche and is on its way to being wallpaper.",
    evidence:
      "High frequency, but so widely copied that it is losing its edge. Explore rather than exploit.",
  },
  {
    id: "identity-over-process",
    name: "Elevate to identity",
    structure:
      "Short, declarative, no mechanism. Tell the reader what they are, not what the product does.",
    why: "Skips the feature conversation entirely. Works on senior buyers who resent being sold a tool but respond to being understood.",
    observed:
      "Strategic Profits: 'Your greatest business asset is not your process. It is your judgment... Do not just teach AI what you do. Teach it how you think.'",
    forLightSchool:
      "Fits team training better than any other offer — the buyer is a leader deciding what their team becomes, not a user buying software.",
    evidence:
      "Shortest ad in the set and still running. Distinct enough to be worth a slot every batch.",
  },
  {
    id: "gap-live-hands-on",
    name: "The gap nobody is filling",
    structure:
      "Position against self-paced learning: a room, a real problem, a thing that exists at the end.",
    why: "Not a hook pattern so much as a positioning finding, and the most valuable line in this file.",
    observed:
      "Across ~2,700 ads: Synthesia sells a tool, CodeRed sells self-paced courses, Transform Learning sells career change, Udemy sells measurement. Nobody in the set advertises live, hands-on team workshops.",
    forLightSchool:
      "The category is uncontested in this data. Lead with what only a live session can promise — your team's actual problem, solved in the room, with the thing still running on Monday.",
    evidence:
      "Absence across the full result set. The clearest opening available.",
  },
];

/** Compact form for the generate prompt — structure and application only. */
export function hookBriefBlock(): string {
  return [
    "PROVEN HOOK PATTERNS — reverse-engineered from ads currently running in this",
    "niche, ranked by how long they have run and how many variants were built.",
    "Use the structure. Never reuse a competitor's wording.",
    "",
    ...HOOK_PATTERNS.map((h) =>
      [
        `[${h.id}] ${h.name}`,
        `  structure: ${h.structure}`,
        `  why it works: ${h.why}`,
        `  for us: ${h.forLightSchool}`,
      ].join("\n"),
    ),
    "",
    "Across the batch, use a different pattern for each ad. Note which pattern",
    "each ad uses in its rationale so performance can be attributed back to it.",
  ].join("\n");
}

/** Seeded into the Context panel so the operator can see and toggle the intel. */
export const COMPETITOR_INTEL = {
  title: "Competitor ad teardown — AI training niche",
  body: [
    "Meta Ad Library, UK, active ads sorted by total impressions, Aug 2026 (~2,700 results).",
    "",
    "SYNTHESIA dominates the niche — 20+ live variants running continuously since 22 Jun.",
    "Formula: audience call-out ('Training folks -') → year stamp ('it's 2026') → category",
    "negation ('forget boring PowerPoints') → three numbered steps → objections in parallel",
    "('Need to update? Simply change the text') → 'P.S. used by 50,000 teams, rated 4.7/5'.",
    "",
    "CODERED, 6 ads on one creative since 3 Jul: indicts the category ('Most courses use fake",
    "tools to teach and call it training'), proves with named tools (PyRIT, crAPI, Burp, Kali),",
    "anchors price ($79 instead of $399).",
    "",
    "TRANSFORM LEARNING ACADEMY: long personal narrative, negation list of assumed paths",
    "('❌ learning to code ❌ going back to university'), salary numbers, 90-day bound, guarantee.",
    "",
    "STRATEGIC PROFITS: shortest ad in the set, no mechanism at all — 'Your greatest business",
    "asset is not your process. It is your judgment.'",
    "",
    "UDEMY BUSINESS, to the L&D buyer: 'Training hours do not equal workforce capability.'",
    "",
    "THE GAP: everyone here sells a tool, a self-paced course, or a career change. Nobody in",
    "the set advertises live, hands-on team workshops where the team's own problem gets solved",
    "in the room. That position is uncontested.",
    "",
    "SATURATED — avoid or subvert: 'it's 2026', 'Fortune 100 use us', AI-avatar talking heads,",
    "'X steps to...' listicles about video tools.",
  ].join("\n"),
};
