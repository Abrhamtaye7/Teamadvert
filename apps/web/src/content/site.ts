// Everything the public website says about the company lives here. Edit this file to change the site.
// Values starting with "TODO:" are placeholders: `npm run package:cpanel` refuses to build until they are replaced.
//
// Pictures: every service and sub-service shows a branded illustration until you add a real photo to
// src/assets/services/ named "<service-slug>.jpg" or "<service-slug>--<sub-slug>.jpg" (also .jpeg/.png/.webp).
// Photos are resized and compressed automatically for phones.

export const SITE = {
  name: "TEAM ADVERT PLC",
  shortName: "Team Advert",
  url: "https://teamadvertplc.com",
  tagline: "Advertising, branding and printing in Addis Ababa",
  description:
    "TEAM ADVERT PLC designs, produces and installs signage, banners, vehicle branding and printed materials for businesses in Addis Ababa and across Ethiopia.",

  contact: {
    /** Shown in this order; the first is the main number */
    phones: ["+251 98 813 9999", "+251 93 805 6657"],
    /** International format without + or spaces */
    whatsapp: "251938056657",
    telegram: "Teamadvert",
    email: "info@teamadvertplc.com",
    address: "Gabon St, Kirkos Sub-city",
    city: "Addis Ababa",
    cityLocal: "አዲስ አበባ",
    country: "Ethiopia",
    /** Leave "" to hide until exact hours are known, e.g. "Mon–Fri 8:30–17:30, Sat 8:30–12:30" */
    hours: "",
    mapUrl: "https://maps.app.goo.gl/eryWAAkWJxADAhma8",
  },

  social: {
    // Leave "" to hide a network
    telegram: "https://t.me/Teamadvert",
    tiktok: "https://www.tiktok.com/@teamadvert",
    facebook: "",
    instagram: "",
    linkedin: "",
  },

  /** About page. Draft written from the facts supplied — review and edit freely. */
  about: [
    "Team Advert PLC is an advertising, branding and printing company based on Gabon Street in Kirkos, Addis Ababa. For more than eight years we have designed, produced and installed signs, banners, vehicle graphics and printed materials for businesses across Ethiopia — over 42,000 jobs so far.",
    "Our designers, production team and installers work together on every order, so your artwork, colours and deadline stay with one team from the first sketch to the finished result. Whether it is a single business card or the branding for a whole fleet, every job gets the same care.",
  ],

  /** Headline numbers on the home page (leave the array empty to hide). */
  stats: [
    { value: "8+", label: "Years in business" },
    { value: "42,000+", label: "Jobs completed" },
    { value: "10", label: "Services under one roof" },
  ],

  /**
   * Services and sub-services. Icons name the illustration used until a photo is added:
   * see ServicePicture.astro for the available icon names.
   */
  services: [
    {
      slug: "signage",
      icon: "signpost",
      title: "Signage & lightboxes",
      summary: "Indoor and outdoor signs, 3D letters and illuminated lightboxes that make your business easy to find.",
      items: [
        { slug: "shop-front", title: "Shop front & fascia signs", icon: "store" },
        { slug: "3d-letters", title: "3D & acrylic letters", icon: "type" },
        { slug: "lightboxes", title: "LED lightboxes", icon: "lightbulb" },
        { slug: "neon", title: "LED neon signs", icon: "sparkles" },
        { slug: "directional", title: "Directional & safety signs", icon: "milestone" },
      ],
    },
    {
      slug: "large-format",
      icon: "image",
      title: "Banners & large-format print",
      summary: "Flex banners, roll-ups, backdrops and billboards printed sharp and built to last outdoors.",
      items: [
        { slug: "flex-banners", title: "Flex & mesh banners", icon: "flag" },
        { slug: "roll-ups", title: "Roll-up & X-banner stands", icon: "panel-top" },
        { slug: "backdrops", title: "Event backdrops", icon: "presentation" },
        { slug: "billboards", title: "Billboards", icon: "rectangle-horizontal" },
        { slug: "posters", title: "Posters & canvas prints", icon: "frame" },
      ],
    },
    {
      slug: "vehicle-branding",
      icon: "truck",
      title: "Vehicle branding",
      summary: "Turn company cars, vans, buses and trucks into moving adverts with durable vinyl graphics.",
      items: [
        { slug: "full-wraps", title: "Full & partial wraps", icon: "car" },
        { slug: "fleet", title: "Fleet branding", icon: "truck" },
        { slug: "door-logos", title: "Door logos & lettering", icon: "car-front" },
        { slug: "bus", title: "Bus & minibus branding", icon: "bus" },
      ],
    },
    {
      slug: "printing",
      icon: "printer",
      title: "Printing & stationery",
      summary: "Business cards, brochures, flyers and company stationery with consistent colour every time.",
      items: [
        { slug: "business-cards", title: "Business cards", icon: "id-card" },
        { slug: "letterheads", title: "Letterheads & envelopes", icon: "mail" },
        { slug: "flyers", title: "Flyers & brochures", icon: "book-open" },
        { slug: "receipt-books", title: "Receipt & invoice books", icon: "receipt" },
        { slug: "calendars", title: "Calendars & diaries", icon: "calendar" },
      ],
    },
    {
      slug: "stickers",
      icon: "sticker",
      title: "Stickers & labels",
      summary: "Cut vinyl, printed stickers and product labels in any shape and size.",
      items: [
        { slug: "vinyl-stickers", title: "Printed & cut vinyl stickers", icon: "sticker" },
        { slug: "product-labels", title: "Product labels", icon: "tag" },
        { slug: "window-graphics", title: "Window graphics", icon: "app-window" },
        { slug: "floor-graphics", title: "Floor graphics", icon: "footprints" },
      ],
    },
    {
      slug: "interior-branding",
      icon: "building",
      title: "Office & interior branding",
      summary: "Bring your brand into the workplace with wall graphics, frosted glass and reception signs.",
      items: [
        { slug: "wall-graphics", title: "Wall graphics & wallpaper", icon: "wallpaper" },
        { slug: "frosted-film", title: "Frosted & decorative glass film", icon: "square-dashed" },
        { slug: "reception", title: "Reception logo walls", icon: "landmark" },
        { slug: "office-signs", title: "Door & office signs", icon: "door-open" },
      ],
    },
    {
      slug: "events",
      icon: "tent",
      title: "Exhibition & event branding",
      summary: "Stands, backdrops and branded displays that make you stand out at expos, launches and conferences.",
      items: [
        { slug: "stands", title: "Exhibition stands", icon: "store" },
        { slug: "pop-ups", title: "Pop-up displays", icon: "panel-top" },
        { slug: "table-covers", title: "Branded table covers", icon: "table" },
        { slug: "tents", title: "Branded tents & canopies", icon: "tent" },
      ],
    },
    {
      slug: "branding",
      icon: "palette",
      title: "Branding & graphic design",
      summary: "Logos, brand identities and campaign artwork designed by our in-house team.",
      items: [
        { slug: "logos", title: "Logo & identity design", icon: "pen-tool" },
        { slug: "guidelines", title: "Brand guidelines", icon: "book" },
        { slug: "campaigns", title: "Campaign artwork", icon: "megaphone" },
        { slug: "social-media", title: "Social media graphics", icon: "smartphone" },
      ],
    },
    {
      slug: "promotional",
      icon: "gift",
      title: "Promotional items",
      summary: "Branded clothing, mugs, pens and giveaways for events, staff and corporate gifts.",
      items: [
        { slug: "apparel", title: "T-shirts, caps & uniforms", icon: "shirt" },
        { slug: "mugs", title: "Mugs & bottles", icon: "coffee" },
        { slug: "pens", title: "Pens & notebooks", icon: "pen" },
        { slug: "bags", title: "Bags & umbrellas", icon: "shopping-bag" },
        { slug: "giveaways", title: "Event giveaways", icon: "gift" },
      ],
    },
    {
      slug: "laser-engraving",
      icon: "zap",
      title: "Laser cutting & engraving",
      summary: "Precision cutting and engraving on acrylic, wood and metal for signs, plaques and awards.",
      items: [
        { slug: "acrylic", title: "Acrylic cutting", icon: "scissors" },
        { slug: "plaques", title: "Plaques & name plates", icon: "award" },
        { slug: "trophies", title: "Trophies & awards", icon: "trophy" },
        { slug: "wood", title: "Wood engraving", icon: "trees" },
      ],
    },
  ],

  /** How a job works, shown on the home and about pages. */
  process: [
    { title: "Tell us what you need", text: "Call, WhatsApp, Telegram or send the quote form with sizes and quantities." },
    { title: "Get a proforma", text: "We send a clear proforma invoice with prices, VAT and delivery time." },
    { title: "Design & approve", text: "Our designers prepare the artwork and you approve it before production." },
    { title: "Production & delivery", text: "We produce, install or deliver on schedule and keep you updated." },
  ],
};

export type Service = (typeof SITE.services)[number];
export type SubService = Service["items"][number];

export const isPlaceholder = (value: string) => value.startsWith("TODO:");
/** A value to show, or undefined while it is empty or still a placeholder. */
export const ready = (value: string) => (value && !isPlaceholder(value) ? value : undefined);

/** "tel:" link for a display number like "+251 98 813 9999" */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
export const whatsappHref = () => `https://wa.me/${SITE.contact.whatsapp}`;
export const telegramHref = () => `https://t.me/${SITE.contact.telegram}`;
export const fullAddress = () => [SITE.contact.address, SITE.contact.city, SITE.contact.country].filter(Boolean).join(", ");
