import axios from "axios";
import { config } from "../config/env";
import { log } from "../utils/logger";

export interface CbeVerificationResult {
  success: boolean;
  issues?: string[];
  parsed?: {
    receiver?: string;
    account?: string;
    reference?: string;
    amount?: number;
  };
}

export async function verifyCbePayment(transactionNumber: string, expectedAmount: number): Promise<CbeVerificationResult> {
  const url = `${config.cbeBaseUrl}${transactionNumber}57045219`;
  const issues: string[] = [];
  try {
    const pdfBuffer = (await axios.get(url, { responseType: "arraybuffer" })).data as Buffer;
    const text = pdfBuffer.toString("utf8");
    const receiver = extract(text, /Receiver\s*:?\s*(.+)/i);
    const account = extract(text, /(Account|A\/C)\s*:?\s*([0-9\*]+)/i);
    const reference = extract(text, /(Reference No|Reference)\s*:?\s*([A-Z0-9]+)/i);
    const amountRaw = extract(text, /(Amount|Transferred Amount)\s*:?\s*([0-9,.]+)/i);
    const amount = amountRaw ? Number(amountRaw.replace(/,/g, "")) : undefined;

    if (!receiver || !receiver.toUpperCase().includes("TEAM ADVERT")) issues.push("Receiver mismatch");
    if (!account || !account.includes("5219")) issues.push("Account mismatch");
    if (!reference || !reference.includes(transactionNumber)) issues.push("Reference mismatch");
    if (amount === undefined || Number(amount.toFixed(2)) !== Number(expectedAmount.toFixed(2))) issues.push("Amount mismatch");

    return {
      success: issues.length === 0,
      issues: issues.length ? issues : undefined,
      parsed: { receiver, account, reference, amount },
    };
  } catch (error) {
    log.error("CBE verification failed", error);
    issues.push("Unable to download or parse CBE PDF");
    return { success: false, issues };
  }
}

function extract(text: string, regex: RegExp) {
  const match = regex.exec(text);
  if (match?.[2]) return match[2].trim();
  if (match?.[1]) return match[1].trim();
  return undefined;
}
