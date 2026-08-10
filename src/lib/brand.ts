/**
 * Ground truth about the advertiser. This is the one piece of context that is
 * never generated — everything else the machine writes is derived from it plus
 * whatever the operator adds in the Context panel.
 */

/**
 * Palette and mark lifted from the live site so generated creative sits next
 * to the real thing without looking borrowed.
 */
export const BRAND_STYLE = {
  violet: "#6868E8",
  violetSoft: "#DEDCFA",
  violetWhisper: "#F0EFFE",
  ink: "#0A0A0B",
  inkSoft: "#3E3E42",
  inkMuted: "#6F6F76",
  /** Served from /public — also sent to image models as a reference. */
  logoSvg: "/lightschool-logo.svg",
  markPng: "lightschool-mark.png",
  /** What the mark actually depicts, for models that only get words. */
  markDescription:
    "the Light School mark: fine rays of light orbiting a square microchip core",
  /** Appended to every image prompt so a batch reads as one campaign. */
  artDirection: [
    "Art direction: calm, premium, editorial. Natural light, real people at real desks,",
    "shallow depth of field, generous negative space. Muted neutrals with a single",
    "violet accent (#6868E8). Never stock-photo cheesy, never neon, never sci-fi,",
    "no glowing brains, no robots, no circuit-board clichés.",
  ].join(" "),
} as const;

export const BRAND = {
  name: "Light School",
  url: "https://lightschool.com",
  oneLiner:
    "Hands-on AI education: workshops, team training, and free lessons for people who want to build real things with AI.",
  audience:
    "Non-technical professionals, founders, and operators who want to build working AI projects for actual business problems — not theory.",
  teacher:
    "Taught by Nick Sarafa, a 15-year software veteran and former CTO.",
  proof: [
    "Taught more than 1,300 people",
    'Student quote: "I feel like I now have a super power"',
    "A student's internal portal replaced $800/month in SaaS and paid for the program in the first month",
    "Student builds include booking systems, dashboards, trading bots, and automation workflows",
  ],
  offers: {
    "free-lesson": {
      label: "Free lesson / Campus",
      cta: "Start for Free",
      landing: "https://lightschool.com/campus",
      note: "Free setup guides and tutorials. Lowest friction entry point.",
    },
    workshop: {
      label: "AI Workshop",
      cta: "Join a Workshop",
      landing: "https://lightschool.com/workshops",
      note: "Online on Wednesdays, in person in Lisbon. Build a real project live.",
    },
    "team-training": {
      label: "Team training",
      cta: "Train Your Team",
      landing: "https://lightschool.com/teams",
      note: "Custom programs for companies. High value, low volume, long cycle.",
    },
    campus: {
      label: "Campus membership",
      cta: "Explore Campus",
      landing: "https://lightschool.com/campus",
      note: "Ongoing lessons and setup guides.",
    },
  },
  voice:
    "Optimistic, plain-spoken, action-oriented. Demystifies AI without hype. Talks about what people build, not what models can do. Signature idea: 'the gap between having an idea and seeing it live is now almost nothing.'",
  avoid: [
    "Hype words like revolutionary, game-changing, unlock the power of",
    "Vague promises with no concrete build attached",
    "Claiming income or job outcomes",
    "Anything that reads like a crypto ad",
  ],
} as const;

export type OfferKey = keyof typeof BRAND.offers;

export function brandBlock(): string {
  return [
    `ADVERTISER: ${BRAND.name} (${BRAND.url})`,
    `WHAT IT IS: ${BRAND.oneLiner}`,
    `WHO IT IS FOR: ${BRAND.audience}`,
    `WHO TEACHES IT: ${BRAND.teacher}`,
    `VOICE: ${BRAND.voice}`,
    "",
    "PROOF POINTS (use real ones only):",
    ...BRAND.proof.map((p) => `- ${p}`),
    "",
    "OFFERS:",
    ...Object.entries(BRAND.offers).map(
      ([k, v]) => `- ${k}: ${v.label}. CTA "${v.cta}". ${v.note}`,
    ),
    "",
    "NEVER:",
    ...BRAND.avoid.map((a) => `- ${a}`),
  ].join("\n");
}
