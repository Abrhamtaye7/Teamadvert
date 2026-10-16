import { describe, expect, it } from "vitest";
import { hashPin, isValidPin, verifyPin } from "./pin";

describe("pin hashing", () => {
  it("verifies the right PIN and rejects a wrong one", async () => {
    const hash = await hashPin("4821");
    expect(await verifyPin("4821", hash)).toBe(true);
    expect(await verifyPin("4822", hash)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPin("1111")).not.toBe(await hashPin("1111"));
  });

  it("rejects malformed or foreign hashes", async () => {
    expect(await verifyPin("1234", "")).toBe(false);
    expect(await verifyPin("1234", "$2a$10$abcdefghijklmnopqrstuv")).toBe(false);
  });

  it("only accepts exactly four digits", () => {
    expect(isValidPin("0123")).toBe(true);
    for (const bad of ["123", "12345", "12a4", " 1234", ""]) expect(isValidPin(bad)).toBe(false);
  });
});
