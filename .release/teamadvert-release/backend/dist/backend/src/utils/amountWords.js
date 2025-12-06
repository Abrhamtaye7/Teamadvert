"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.amountToWords = amountToWords;
const units = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function chunkToWords(n) {
    const parts = [];
    if (n >= 100) {
        parts.push(`${units[Math.floor(n / 100)]} hundred`);
        n = n % 100;
    }
    if (n >= 20) {
        parts.push(tens[Math.floor(n / 10)] + (n % 10 ? `-${units[n % 10]}` : ""));
    }
    else if (n > 0) {
        parts.push(units[n]);
    }
    return parts.join(" ");
}
function amountToWords(amount) {
    if (!Number.isFinite(amount))
        return "";
    const whole = Math.floor(amount);
    const cents = Math.round((amount - whole) * 100);
    if (whole === 0 && cents === 0)
        return "zero birr";
    const scales = ["", " thousand", " million", " billion", " trillion"];
    const chunks = [];
    let num = whole;
    let scale = 0;
    while (num > 0 && scale < scales.length) {
        const chunk = num % 1000;
        if (chunk)
            chunks.unshift(`${chunkToWords(chunk)}${scales[scale]}`.trim());
        num = Math.floor(num / 1000);
        scale++;
    }
    const birr = chunks.join(" ") || "zero";
    const centsText = cents ? ` and ${chunkToWords(cents)} cents` : "";
    return `${birr} birr${centsText}`;
}
