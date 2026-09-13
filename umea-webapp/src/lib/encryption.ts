import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "umea-fx60-super-secure-key-32ch"; // Exactly 32 chars

// Ensure 32-byte key
function getKey(): Buffer {
  const hash = crypto.createHash("sha256");
  hash.update(ENCRYPTION_KEY);
  return hash.digest();
}

export function encryptPassword(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptPassword(cipherText: string): string {
  if (!cipherText || !cipherText.includes(":")) return cipherText;

  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) return cipherText;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Failed to decrypt password:", err);
    return "";
  }
}
