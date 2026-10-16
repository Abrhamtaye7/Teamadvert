// Everything the public website says about the company lives here. Edit this file to change the site.
// Values starting with "TODO:" are placeholders: `npm run package:cpanel` refuses to build until they are replaced.

export const SITE = {
  name: "TEAM ADVERT PLC",
  shortName: "Team Advert",
  url: "https://teamadvertplc.com",
  tagline: "Advertising, branding and printing in Addis Ababa",
  description:
    "TEAM ADVERT PLC designs and produces signage, banners, vehicle branding and printed materials for businesses in Addis Ababa and across Ethiopia.",

  contact: {
    phone: "TODO: main phone, e.g. +251 911 000000",
    whatsapp: "TODO: WhatsApp number in international format, e.g. 251911000000",
    email: "TODO: public email, e.g. info@teamadvertplc.com",
    address: "TODO: street / building, sub-city",
    city: "Addis Ababa",
    country: "Ethiopia",
    hours: "TODO: opening hours, e.g. Mon–Sat 8:30–17:30",
    /** Google Maps link to the office (optional, leave "" to hide) */
    mapUrl: "",
  },

  social: {
    // Leave "" to hide a network
    facebook: "",
    instagram: "",
    telegram: "",
    tiktok: "",
    linkedin: "",
  },

  /** Short company story for the About page. */
  about: [
    "TODO: one paragraph about when and why Team Advert was founded.",
    "TODO: one paragraph about the team, equipment and the clients you serve.",
  ],

  /** Headline numbers on the home page (leave the array empty to hide). */
  stats: [] as { value: string; label: string }[],

  /**
   * Services shown on the home and services pages. These are typical for an advertising and printing
   * company; edit them to match exactly what Team Advert offers.
   */
  services: [
    {
      slug: "signage",
      icon: "sign",
      title: "Signage & lightboxes",
      summary: "Indoor and outdoor signs, 3D letters and illuminated lightboxes that make your shop easy to find.",
      points: ["Shop fronts and fascia signs", "3D and acrylic letters", "LED lightboxes", "Directional and safety signs"],
    },
    {
      slug: "large-format",
      icon: "image",
      title: "Banners & large-format print",
      summary: "Flex banners, roll-ups, backdrops and billboards printed sharp and built to last outdoors.",
      points: ["Flex and mesh banners", "Roll-up and pop-up stands", "Event backdrops", "Billboards"],
    },
    {
      slug: "vehicle-branding",
      icon: "truck",
      title: "Vehicle branding",
      summary: "Turn company cars, vans and trucks into moving adverts with durable vinyl wraps and stickers.",
      points: ["Full and partial wraps", "Fleet branding", "Door logos and lettering", "Removable vinyl"],
    },
    {
      slug: "printing",
      icon: "printer",
      title: "Printing & stationery",
      summary: "Business cards, brochures, flyers, letterheads and stickers with consistent colour every time.",
      points: ["Business cards and letterheads", "Flyers and brochures", "Stickers and labels", "Calendars and diaries"],
    },
    {
      slug: "branding",
      icon: "palette",
      title: "Branding & graphic design",
      summary: "Logos, brand identities and campaign artwork designed by our in-house team.",
      points: ["Logo and identity design", "Brand guidelines", "Campaign artwork", "Social media graphics"],
    },
    {
      slug: "promotional",
      icon: "gift",
      title: "Promotional items",
      summary: "Branded T-shirts, caps, mugs, pens and giveaways for events and corporate gifts.",
      points: ["T-shirts and caps", "Mugs and bottles", "Pens and notebooks", "Event giveaways"],
    },
  ],

  /** How a job works, shown on the home page. */
  process: [
    { title: "Tell us what you need", text: "Call, WhatsApp or send the quote form with sizes and quantities." },
    { title: "Get a proforma", text: "We send a clear proforma invoice with prices, VAT and delivery time." },
    { title: "Design & approve", text: "Our designers prepare the artwork and you approve it before production." },
    { title: "Production & delivery", text: "We produce, install or deliver on schedule and keep you updated." },
  ],
};

export type Service = (typeof SITE.services)[number];

export const isPlaceholder = (value: string) => value.startsWith("TODO:");
/** A value to show, or undefined while it is still a placeholder. */
export const ready = (value: string) => (value && !isPlaceholder(value) ? value : undefined);
