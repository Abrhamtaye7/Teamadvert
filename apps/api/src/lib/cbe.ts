import { extractText, getDocumentProxy } from "unpdf";

export type CbeVerificationResult = {
  success: boolean;
  issues?: string[];
  parsed?: { receiver?: string; account?: string; reference?: string; amount?: number };
};

export type CbeVerifier = (transactionNumber: string, expectedAmount: number) => Promise<CbeVerificationResult>;

export type CbeConfig = {
  /** Receipt URL prefix; the transaction number and account suffix are appended (legacy PRD rule). */
  baseUrl: string;
  accountSuffix: string;
  /** Text the receiver name must contain, and the account's last digits. */
  receiverName: string;
  accountLast4: string;
};

export const DEFAULT_CBE_CONFIG: CbeConfig = {
  baseUrl: "https://apps.cbe.com.et:100/?id=",
  accountSuffix: "57045219",
  receiverName: "TEAM ADVERT",
  accountLast4: "5219",
};

function extract(text: string, regex: RegExp) {
  const match = regex.exec(text);
  return (match?.[2] ?? match?.[1])?.trim();
}

/** Applies the PRD matching rules to the receipt's text. Pure, so it can be tested without the bank. */
export function checkReceiptText(text: string, transactionNumber: string, expectedAmount: number, config = DEFAULT_CBE_CONFIG): CbeVerificationResult {
  const receiver = extract(text, /Receiver\s*(?:Name)?\s*:?\s*([^\n]+)/i);
  const account = extract(text, /(Account|A\/C)[^\n:]*:?\s*([0-9*]+)/i);
  const reference = extract(text, /(Reference No\.?|Reference)[^\n:]*:?\s*([A-Z0-9]+)/i);
  const amountRaw = extract(text, /(Transferred Amount|Amount)[^\n:0-9]*:?\s*(?:ETB\s*)?([0-9][0-9,]*\.?[0-9]*)/i);
  const amount = amountRaw ? Number(amountRaw.replace(/,/g, "")) : undefined;

  const issues: string[] = [];
  if (!receiver?.toUpperCase().includes(config.receiverName)) issues.push("Receiver mismatch");
  if (!account?.includes(config.accountLast4)) issues.push("Account mismatch");
  if (!reference?.toUpperCase().includes(transactionNumber.toUpperCase())) issues.push("Reference mismatch");
  if (amount === undefined || Math.round(amount * 100) !== Math.round(expectedAmount * 100)) issues.push("Amount mismatch");

  return { success: issues.length === 0, issues: issues.length ? issues : undefined, parsed: { receiver, account, reference, amount } };
}

/**
 * Downloads the CBE receipt PDF and checks it. Legacy read the PDF bytes as UTF-8 text, which never contains
 * the visible text, so every verification failed; this extracts the real text first.
 */
export function createCbeVerifier(config = DEFAULT_CBE_CONFIG, fetchImpl: typeof fetch = fetch): CbeVerifier {
  return async (transactionNumber, expectedAmount) => {
    const url = `${config.baseUrl}${encodeURIComponent(transactionNumber)}${config.accountSuffix}`;
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return { success: false, issues: [`CBE returned HTTP ${res.status}`] };
      const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: true });
      return checkReceiptText(text, transactionNumber, expectedAmount, config);
    } catch (err) {
      console.error("CBE verification failed", err);
      return { success: false, issues: ["Unable to download or read the CBE receipt"] };
    }
  };
}
