// Search engine (SEO) and answer engine (AEO / GEO) content: the words people search for, and questions with
// answers that Google, ChatGPT, Gemini, Perplexity and Claude can quote. Edit freely; keep answers factual.
//
// Amharic search terms were written as common spellings and should be checked by a native speaker.
import { fullAddress, SITE, type Service } from "./site";

export type Faq = { q: string; a: string };

/** Words for the whole business, used on every page and in llms.txt. */
export const BUSINESS_KEYWORDS = [
  "advertising company Addis Ababa",
  "printing company Addis Ababa",
  "signage company Ethiopia",
  "branding agency Addis Ababa",
  "print shop Addis Ababa",
  "advertising and printing Ethiopia",
  "Team Advert PLC",
  "Gabon Street Kirkos",
];

export const BUSINESS_KEYWORDS_AMHARIC = ["ማስታወቂያ ድርጅት", "ማተሚያ ቤት", "ህትመት", "ማስታወቂያ", "ብራንዲንግ", "አዲስ አበባ"];

/** Per service (by slug): what people type into Google, in English and Amharic. */
export const SERVICE_KEYWORDS: Record<string, { en: string[]; am: string[] }> = {
  signage: {
    en: ["sign board Addis Ababa", "shop sign", "signage company Ethiopia", "3D letter signs", "acrylic letters", "LED light box", "neon sign", "illuminated signs", "directional signs", "safety signs", "office door signs"],
    am: ["ታፔላ", "የማስታወቂያ ታፔላ", "ላይት ቦክስ", "ኒዮን"],
  },
  "large-format": {
    en: ["banner printing Addis Ababa", "flex banner", "mesh banner", "roll-up banner", "X-banner stand", "backdrop printing", "billboard Ethiopia", "poster printing", "canvas printing", "large format printing"],
    am: ["ባነር", "ባነር ህትመት", "ሮል አፕ ባነር", "ቢልቦርድ", "ፖስተር"],
  },
  "vehicle-branding": {
    en: ["car branding Addis Ababa", "vehicle wrap Ethiopia", "car stickers", "fleet branding", "bus branding", "minibus branding", "truck branding", "door logo stickers", "vehicle graphics"],
    am: ["የመኪና ማስታወቂያ", "የመኪና ስቲከር", "የመኪና ብራንዲንግ"],
  },
  printing: {
    en: ["printing press Addis Ababa", "business card printing", "letterhead printing", "envelope printing", "flyer printing", "brochure printing", "receipt book printing", "invoice book printing", "calendar printing", "diary printing"],
    am: ["ህትመት", "ቢዝነስ ካርድ", "ደረሰኝ ህትመት", "ብሮሸር", "ካሌንደር"],
  },
  stickers: {
    en: ["sticker printing Addis Ababa", "vinyl stickers", "cut vinyl lettering", "product labels", "label printing", "window graphics", "floor graphics"],
    am: ["ስቲከር", "ስቲከር ህትመት", "ሌብል ህትመት"],
  },
  "interior-branding": {
    en: ["office branding Addis Ababa", "wall graphics", "wallpaper printing", "frosted glass film", "glass stickers", "reception logo wall", "office signs"],
    am: ["የቢሮ ብራንዲንግ", "የመስታወት ስቲከር", "ዎል ፔፐር"],
  },
  events: {
    en: ["exhibition stand Addis Ababa", "event branding", "trade show booth", "pop-up display", "branded table cover", "branded tent", "canopy printing", "event backdrop"],
    am: ["የኤግዚቢሽን ስታንድ", "ባክድሮፕ", "የዝግጅት ማስታወቂያ"],
  },
  branding: {
    en: ["logo design Addis Ababa", "graphic design Ethiopia", "brand identity design", "brand guidelines", "advertising design", "campaign artwork", "social media graphics"],
    am: ["ሎጎ ዲዛይን", "ግራፊክ ዲዛይን", "ብራንዲንግ"],
  },
  promotional: {
    en: ["t-shirt printing Addis Ababa", "cap printing", "uniform printing", "mug printing", "branded pens", "branded notebooks", "tote bags", "branded umbrellas", "corporate gifts", "event giveaways"],
    am: ["ቲሸርት ህትመት", "ኮፍያ ህትመት", "ሙግ ህትመት", "የድርጅት ስጦታዎች"],
  },
  "laser-engraving": {
    en: ["laser cutting Addis Ababa", "laser engraving", "acrylic cutting", "name plates", "plaques", "trophies and awards", "wood engraving"],
    am: ["ሌዘር ካት", "ሌዘር ኢንግሬቪንግ", "ዋንጫ"],
  },
};

const services = SITE.services.map((s) => s.title.toLowerCase()).join(", ");
const [phone] = SITE.contact.phones;
const c = SITE.contact;
const { days, opens, closes } = c.openingHours;

/** "Monday–Saturday, 8:00–22:00" */
export const openingText = () => `${days[0]}–${days[days.length - 1]}, ${opens.replace(/^0/, "")}–${closes.replace(/^0/, "")}`;

/** "Gabon St, Kirkos Sub-city (behind Bole Mega), Addis Ababa" */
export const addressWithLandmark = () => `${c.address} (${c.landmark}), ${c.city}`;

/**
 * "Answer capsule": one self-contained paragraph that defines the business, for the top of the home page and for
 * search engines and AI assistants to quote. Facts only, all from site.ts.
 */
export const businessCapsule = () =>
  `${SITE.name} is an advertising, signage and printing company on ${addressWithLandmark()}, Ethiopia. ` +
  `We design, produce and install ${services}, with a free itemised proforma including VAT for every order. ` +
  `Open ${openingText()}.`;

/** The same for one service, shown under the service page's main heading. */
export const serviceCapsule = (s: Service) =>
  `${SITE.name} makes ${s.title.toLowerCase()} in Addis Ababa: ${s.items.map((i) => i.title).join(", ")}. ` +
  `Visit us on ${addressWithLandmark()} (${openingText()}) or call ${phone}; every quote is an itemised proforma with VAT.`;

/** General questions, shown on the FAQ page (/faq/) and in llms.txt. */
export const FAQS: Faq[] = [
  {
    q: `Where is ${SITE.name} located?`,
    a: `${SITE.name} is at ${fullAddress()}, ${c.landmark}. Call ${phone} or open the map on our Contact page for directions.`,
  },
  {
    q: `When is ${SITE.shortName} open?`,
    a: `${openingText()}. Closed on Sunday. You can also send a quote request any time by WhatsApp, Telegram or the form on our website.`,
  },
  {
    q: `What does ${SITE.shortName} make?`,
    a: `We design, produce and install ${services} — for businesses in Addis Ababa and across Ethiopia.`,
  },
  {
    q: "How do I get a price or a quote?",
    a: `Call ${SITE.contact.phones.join(" or ")}, message us on WhatsApp or Telegram, or send the quote form on our website. Tell us the size, quantity and deadline and we reply with an itemised proforma that includes VAT.`,
  },
  {
    q: "Do you design the artwork?",
    a: "Yes. Our in-house designers prepare and adjust your artwork, and you approve it before anything is produced.",
  },
  {
    q: "Do you install signs and vehicle graphics?",
    a: "Yes. Our team mounts signs, wraps vehicles and sets up event displays, and we come back for repairs, replacements and re-prints when you need them.",
  },
  {
    q: "Do you work outside Addis Ababa?",
    a: "Yes. We work for businesses in Addis Ababa and across Ethiopia. Tell us the location when you ask for a quote.",
  },
  {
    q: "Can I order for a whole company, branch network or event?",
    a: "Yes. Send one list — signs, banners, uniforms and giveaways — and we reply with one proforma for everything.",
  },
  {
    q: `How long has ${SITE.shortName} been in business?`,
    a: `More than ${SITE.stats[0]?.value.replace("+", "")} years, with over ${SITE.stats[1]?.value.replace("+", "")} jobs completed.`,
  },
  {
    q: "How can I check that a proforma from you is genuine?",
    a: "Every approved proforma has a QR code. Scan it to see the original prices, validity and our bank details on our website.",
  },
];

/** Questions for one service page, built from its own details. */
export function serviceFaqs(s: Service): Faq[] {
  const name = s.title.toLowerCase();
  // Item names keep their capitals (LED, 3D, T-shirts)
  const items = s.items.map((i) => i.title).join(", ");
  return [
    {
      q: `Where can I get ${name} in Addis Ababa?`,
      a: `At ${SITE.name}, ${addressWithLandmark()}, open ${openingText()}. We make: ${items}. ${s.summary}`,
    },
    {
      q: `What is the price of ${name}?`,
      a: `It depends on the size, material and quantity. Send us those details by phone (${phone}), WhatsApp, Telegram or the quote form and we reply with an itemised proforma that includes VAT, free of charge.`,
    },
    {
      q: "Do you design it too?",
      a: "Yes. Our in-house designers prepare the artwork and you approve it before production. Then we produce it and install or deliver it on the agreed date.",
    },
  ];
}

export const serviceUrl = (slug: string) => `/services/${slug}/`;
