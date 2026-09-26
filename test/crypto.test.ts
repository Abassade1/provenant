import { beforeAll, describe, expect, it } from "vitest";

describe("encryptText / decryptText", () => {
  beforeAll(() => {
    process.env.CHECK_ENCRYPTION_KEY ??= "dev-only-change-me";
  });

  it("round-trips text, including unicode and empty strings", async () => {
    const { encryptText, decryptText } = await import("@/lib/crypto");
    for (const text of ["hello", "", "Contact me at 555-0100 — café ☕", "a".repeat(5000)]) {
      const enc = encryptText(text);
      if (text) expect(enc).not.toContain(text);
      expect(decryptText(enc)).toBe(text);
    }
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", async () => {
    const { encryptText } = await import("@/lib/crypto");
    expect(encryptText("same text")).not.toBe(encryptText("same text"));
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const { encryptText, decryptText } = await import("@/lib/crypto");
    const enc = encryptText("secret");
    const [iv, tag, ct] = enc.split(".");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(".");
    expect(() => decryptText(tampered)).toThrow();
  });
});
