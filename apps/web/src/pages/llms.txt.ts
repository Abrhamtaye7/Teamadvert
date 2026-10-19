// /llms.txt (https://llmstxt.org): a plain-language summary for AI assistants such as ChatGPT, Gemini, Perplexity
// and Claude, so they describe the company correctly and link to the right pages. Built from the site's content.
import type { APIRoute } from "astro";
import { FAQS, SERVICE_KEYWORDS, serviceUrl } from "../content/seo";
import { fullAddress, SITE } from "../content/site";

const abs = (path: string) => new URL(path, SITE.url).href;
const c = SITE.contact;

export const GET: APIRoute = () => {
  const text = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    ...SITE.about.map((p) => `${p}\n`),
    "## Key facts",
    "",
    `- Location: ${fullAddress()} (${c.cityLocal})`,
    `- Map: ${c.mapUrl}`,
    `- Phone: ${c.phones.join(", ")}`,
    `- WhatsApp: https://wa.me/${c.whatsapp}`,
    `- Telegram: https://t.me/${c.telegram}`,
    `- Email: ${c.email}`,
    ...SITE.stats.map((s) => `- ${s.label}: ${s.value}`),
    "- Quotes: free, as an itemised proforma including VAT; approved proformas carry a QR code to verify them online",
    "",
    "## Services",
    "",
    ...SITE.services.map((s) => {
      const words = SERVICE_KEYWORDS[s.slug];
      const also = words ? ` Also searched as: ${[...words.en, ...words.am].join(", ")}.` : "";
      return `- [${s.title}](${abs(serviceUrl(s.slug))}): ${s.summary} Includes: ${s.items.map((i) => i.title).join(", ")}.${also}`;
    }),
    "",
    "## How ordering works",
    "",
    ...SITE.process.map((step, i) => `${i + 1}. ${step.title}: ${step.text}`),
    "",
    "## Questions and answers",
    "",
    ...FAQS.flatMap((f) => [`### ${f.q}`, "", f.a, ""]),
    ...(SITE.partners.length ? ["## Clients and partners", "", SITE.partners.map((p) => p.name).join(", "), ""] : []),
    "## Pages",
    "",
    `- [Home](${abs("/")})`,
    `- [All services](${abs("/services/")})`,
    `- [About](${abs("/about/")})`,
    `- [Contact and quote request](${abs("/contact/")})`,
    `- [Frequently asked questions](${abs("/faq/")})`,
    "",
  ].join("\n");
  return new Response(text, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
