// Company details printed on proformas and job orders. Edit here to change them everywhere.
// Bank account and default payment terms live in packages/shared/company.ts: the public verify page shows them too.
import { COMPANY_BANK, PROFORMA_TERMS } from "@teamadvert/shared/company";

export const COMPANY = {
  name: "TEAM ADVERT PLC",
  city: "Addis Ababa, Ethiopia",
  address: "Gabon St, Kirkos Sub-city, Addis Ababa",
  phones: ["+251 98 813 9999", "+251 93 805 6657"],
  email: "info@teamadvertplc.com",
  website: "teamadvertplc.com",
  bank: COMPANY_BANK,
  defaultTerms: PROFORMA_TERMS,
  proformaDisclaimer: "This is a proforma invoice. No payment is due until a final invoice is issued.",
  defaultValidityDays: 15,
  vatPercent: 15,
};
