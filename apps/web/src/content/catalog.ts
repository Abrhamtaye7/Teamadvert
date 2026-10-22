// Full product catalogue with production methods (supplied by Team Advert, 2026-10-20). Shown as tables on
// /products/ and on the matching service pages, and listed in llms.txt and the structured data.
// `services` = the service pages (slugs in site.ts) that show this category.

export type CatalogCategory = {
  slug: string;
  name: string;
  products: string[];
  methods: string[];
  services: string[];
};

export const CATALOG: CatalogCategory[] = [
  {
    slug: "stationery",
    name: "Corporate Stationery & Identity",
    products: [
      "Business cards (Standard, Spot UV, Foil, Die-cut)",
      "Letterheads & envelopes (DL, C4, C5)",
      "NCR (Carbonless) books: Invoices, receipts, delivery notes",
      "Presentation folders & document binders",
      "Company ID cards & custom printed lanyards",
      "Custom rubber stamps (Self-inking, wax, embossed)",
    ],
    methods: ["Offset Printing", "Digital Laser Printing", "Foil Stamping", "Embossing"],
    services: ["printing", "branding"],
  },
  {
    slug: "marketing",
    name: "Marketing & Promotional Collateral",
    products: [
      "Flyers & leaflets (Single-page, Bi-fold, Tri-fold, Z-fold)",
      "Brochures & company profiles (Saddle-stitched, Perfect-bound)",
      "Posters (A3, A2, A1, B1) & door hangers",
      "Catalogs, booklets, & annual reports",
      "Postcards, event invitations, & greeting cards",
      "Point-of-Sale (POS) materials: Wobblers, tent cards, menus",
    ],
    methods: ["Digital Printing", "High-Speed Web/Sheetfed Offset", "UV Coating"],
    services: ["printing"],
  },
  {
    slug: "large-format",
    name: "Large Format & Outdoor Advertising",
    products: [
      "PVC flex banners (Frontlit, Backlit, Blockout, Mesh)",
      "Vinyl stickers (Gloss/Matte, Clear, One-Way Vision)",
      "Display stands: Roll-up, X-stand, Pop-up walls, Promo tables",
      "Flags: Feather flags, Teardrop flags, Pole flags",
      "Vehicle branding: Full wraps, partial decals, magnetic signs",
      "Window, wall, & floor graphics (Anti-slip laminated)",
    ],
    methods: ["Eco-Solvent", "UV Roll-to-Roll", "Latex Printing", "Vinyl Cutter Plotter"],
    services: ["large-format", "vehicle-branding", "stickers", "interior-branding", "events"],
  },
  {
    slug: "signage",
    name: "Signage & 3D Fabrication",
    products: [
      "3D Channel letters (Acrylic, Stainless Steel, Aluminum)",
      "Lightboxes (LED fabric, Aluminum profile, Vacuum-formed)",
      "Pylon, totem, & monument signs",
      "Wayfinding & directory signs (Indoor/Outdoor, ADA/Braille)",
      "Neon & LED flex custom signs",
      "Engraved plaques & nameplates (Brass, Acrylic, Wood)",
    ],
    methods: ["CNC Routing", "Laser Cutting/Engraving", "Channel Letter Bending", "Welding"],
    services: ["signage", "interior-branding", "laser-engraving"],
  },
  {
    slug: "promotional",
    name: "Promotional Giveaways & Apparel",
    products: [
      "Apparel: T-shirts, polo shirts, hoodies, caps, safety vests",
      "Drinkware: Ceramic mugs, travel tumblers, metal water bottles",
      "Tech accessories: USB flash drives, power banks, mousepads",
      "Writing & desk items: Branded pens, keychains, desk clocks",
      "Bags: Non-woven tote bags, canvas bags, jute bags, drawstring",
      "Awards: Crystal/acrylic trophies, medals, plaques",
    ],
    methods: ["Screen Printing", "DTF (Direct-to-Film)", "Sublimation", "UV Flatbed", "Embroidery", "Pad Printing"],
    services: ["promotional", "laser-engraving"],
  },
  {
    slug: "packaging",
    name: "Packaging & Labeling",
    products: [
      "Custom retail boxes (Folding cartons, rigid boxes, corrugated)",
      "Paper shopping bags (Kraft paper, Art paper with rope handles)",
      "Roll labels & die-cut sheet stickers (Paper, BOPP, Metallic)",
      "Food packaging: Coffee sleeves, burger boxes, greaseproof paper",
      "Security & warranty tamper-evident seals",
      "Hang tags, header cards, & woven garment labels",
    ],
    methods: ["Flexography", "Die-Cutting", "Offset Printing", "Digital Label Printing"],
    services: ["stickers", "printing"],
  },
  {
    slug: "publishing",
    name: "Publishing & Seasonal Print",
    products: [
      "Books (Hardcover, Softcover/Paperback, Spiral/Wire-O)",
      "Magazines, newsletters, & directories",
      "Custom notebooks, journals, & executive diaries",
      "Calendars: Wall calendars, desk tent calendars, pocket calendars",
    ],
    methods: ["Offset Printing", "Perfect Binding", "Case Binding", "Wire-O Punching"],
    services: ["printing"],
  },
  {
    slug: "exhibition",
    name: "Exhibition & Event Fabrication",
    products: [
      "Custom trade show booths (Wooden/Modular octanorm)",
      "Stage backdrops & step-and-repeat media walls",
      "Retail gondola ends & freestanding display units (FSDUs)",
      "Acrylic podiums, ballot boxes, & brochure holders",
    ],
    methods: ["Carpentry", "Metal Fabrication", "UV Flatbed (Foamboard/Forex/Alucobond)"],
    services: ["events"],
  },
];

export const catalogFor = (serviceSlug: string) => CATALOG.filter((c) => c.services.includes(serviceSlug));
