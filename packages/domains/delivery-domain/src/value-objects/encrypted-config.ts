/**
 * AES-256-GCM encryption/decryption for provider configuration secrets.
 * Uses the Web Crypto API, which is available in both Cloudflare Workers and Node.js.
 */

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @param key - 64-character hex string representing a 256-bit key
 * @returns A string in the format `base64(iv):base64(ciphertext)`
 */
export async function encryptConfig(plaintext: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyBytes = await crypto.subtle.importKey(
    'raw',
    hexToBytes(key).buffer as ArrayBuffer,
    'AES-GCM',
    false,
    ['encrypt'],
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyBytes,
    encoder.encode(plaintext),
  );

  return base64Encode(iv) + ':' + base64Encode(new Uint8Array(encrypted));
}

/**
 * Decrypt a ciphertext string that was encrypted with `encryptConfig`.
 *
 * @param ciphertext - A string in the format `base64(iv):base64(ciphertext)`
 * @param key - 64-character hex string representing a 256-bit key
 * @returns The decrypted plaintext string
 */
export async function decryptConfig(ciphertext: string, key: string): Promise<string> {
  const [ivB64, dataB64] = ciphertext.split(':');
  if (!ivB64 || !dataB64) {
    throw new Error('Invalid ciphertext format: expected base64(iv):base64(data)');
  }

  const iv = base64Decode(ivB64);
  const data = base64Decode(dataB64);

  const keyBytes = await crypto.subtle.importKey(
    'raw',
    hexToBytes(key).buffer as ArrayBuffer,
    'AES-GCM',
    false,
    ['decrypt'],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    keyBytes,
    data.buffer as ArrayBuffer,
  );

  return new TextDecoder().decode(decrypted);
}
