const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Gets the encryption key from environment variables.
 * Validates key length and throws if invalid.
 *
 * @returns {Buffer} - 32-byte encryption key
 */
function getEncryptionKey() {
  const key = process.env.GITHUB_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("GITHUB_ENCRYPTION_KEY environment variable is required");
  }

  // If key is provided as hex string, convert to buffer
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }

  // If key is provided as base64 string
  if (key.length === 44 && key.endsWith("=")) {
    return Buffer.from(key, "base64");
  }

  // If key is raw string, hash it to get 32 bytes
  if (key.length !== KEY_LENGTH) {
    return crypto.createHash("sha256").update(key).digest();
  }

  return Buffer.from(key);
}

/**
 * Encrypts a string using AES-256-GCM.
 *
 * @param {string} text - The plaintext to encrypt
 * @returns {string} - Encrypted data as base64 string (iv:authTag:ciphertext)
 */
function encrypt(text) {
  if (!text) return null;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    const result = Buffer.concat([iv, authTag, Buffer.from(encrypted, "base64")]);

    return result.toString("base64");
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts a string that was encrypted using encrypt().
 *
 * @param {string} encryptedText - The encrypted data (base64 string)
 * @returns {string|null} - The decrypted plaintext
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;

  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedText, "base64");

    const iv = data.slice(0, IV_LENGTH);
    const authTag = data.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

module.exports = {
  encrypt,
  decrypt,
};
