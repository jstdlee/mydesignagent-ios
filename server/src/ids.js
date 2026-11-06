import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A random id of letters and digits (21 by default, as artifact ids are). */
export function randomId(length = 21) {
  const bytes = crypto.randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    // 62 * 4 = 248: reject the top of the byte range so every character is equally likely.
    if (bytes[i] < 248) out += ALPHABET[bytes[i] % 62];
  }
  return out.length === length ? out : randomId(length);
}

export const isArtifactId = (value) => typeof value === "string" && /^[A-Za-z0-9]{21}$/.test(value);

export const receiptId = () => `r_${randomId(12)}`;
export const commentId = () => `c_${randomId(10)}`;

export function shortHash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
}

/** Constant-time comparison of two secrets. */
export function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
