/**
 * crypto.js — client-side cryptography for Secure Internet Poker.
 *
 * Algorithms must match backend exactly:
 *   - RSA: 2048-bit, SHA-256
 *   - RSA-OAEP for wrapping session keys
 *   - RSA-PSS for signing (salt length 222)
 *   - DSA: 2048-bit, SHA-256, DER-encoded (jsrsasign)
 *   - AES-GCM, 256-bit, 12-byte IV
 */

import { KEYUTIL, KJUR, hextob64, b64tohex } from "jsrsasign";

const subtle = window.crypto.subtle;

// ---------- base64 helpers ----------

function bytesToB64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
  return btoa(str);
}

function b64ToBytes(s) {
  const raw = atob(s);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function utf8(s) {
  return new TextEncoder().encode(s);
}

// ---------- PEM parsing helpers ----------

function pemToBytes(pem) {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  return b64ToBytes(body);
}

// ---------- session key ----------

export function generateSessionKey() {
  // Raw 32 random bytes for AES-256
  return crypto.getRandomValues(new Uint8Array(32));
}

async function importAesKey(rawBytes) {
  return subtle.importKey("raw", rawBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Cache of imported AES keys keyed by raw bytes reference to avoid re-importing
const aesKeyCache = new WeakMap();

async function asAesKey(keyOrBytes) {
  // Accept either raw Uint8Array or already-imported CryptoKey
  if (keyOrBytes instanceof CryptoKey) return keyOrBytes;
  const bytes = keyOrBytes instanceof Uint8Array ? keyOrBytes : new Uint8Array(keyOrBytes);
  if (aesKeyCache.has(bytes)) return aesKeyCache.get(bytes);
  const k = await importAesKey(bytes);
  aesKeyCache.set(bytes, k);
  return k;
}

// ---------- RSA-OAEP key wrap ----------

async function importRsaOaepPublicKey(pem) {
  return subtle.importKey(
    "spki",
    pemToBytes(pem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
}

export async function wrapSessionKey(housePubPem, sessionKeyBytes) {
  const pubKey = await importRsaOaepPublicKey(housePubPem);
  const wrapped = await subtle.encrypt({ name: "RSA-OAEP" }, pubKey, sessionKeyBytes);
  return bytesToB64(new Uint8Array(wrapped));
}

// ---------- RSA-PSS signing ----------

async function importRsaPssPrivateKey(pem) {
  return subtle.importKey(
    "pkcs8",
    pemToBytes(pem),
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function importRsaPssPublicKey(pem) {
  return subtle.importKey(
    "spki",
    pemToBytes(pem),
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

export async function signRSA(privatePem, messageBytes) {
  const key = await importRsaPssPrivateKey(privatePem);
  const sig = await subtle.sign({ name: "RSA-PSS", saltLength: 222 }, key, messageBytes);
  return new Uint8Array(sig);
}

export async function verifyRSA(publicPem, messageBytes, signatureBytes) {
  const key = await importRsaPssPublicKey(publicPem);
  const sigBuf = signatureBytes instanceof Uint8Array ? signatureBytes : new Uint8Array(signatureBytes);
  return subtle.verify({ name: "RSA-PSS", saltLength: 222 }, key, sigBuf, messageBytes);
}

// ---------- DSA via jsrsasign ----------

function bytesToHex(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = "";
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export async function signDSA(privatePem, messageBytes) {
  const privKey = KEYUTIL.getKey(privatePem);
  const sig = new KJUR.crypto.Signature({ alg: "SHA256withDSA" });
  sig.init(privKey);
  sig.updateHex(bytesToHex(messageBytes));
  const sigHex = sig.sign();
  return hexToBytes(sigHex);
}

export async function verifyDSA(publicPem, messageBytes, signatureBytes) {
  const pubKey = KEYUTIL.getKey(publicPem);
  const sig = new KJUR.crypto.Signature({ alg: "SHA256withDSA" });
  sig.init(pubKey);
  sig.updateHex(bytesToHex(messageBytes));
  const sigBytes = signatureBytes instanceof Uint8Array ? signatureBytes : new Uint8Array(signatureBytes);
  return sig.verify(bytesToHex(sigBytes));
}

// ---------- AES-GCM ----------

export async function aesEncrypt(sessionKey, plaintext) {
  const key = await asAesKey(sessionKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const msgBytes = typeof plaintext === "string" ? utf8(plaintext) : new Uint8Array(plaintext);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, key, msgBytes);
  return {
    ciphertext: bytesToB64(new Uint8Array(ciphertext)),
    iv: bytesToB64(iv),
  };
}

export async function aesDecrypt(sessionKey, ivB64, ciphertextB64) {
  const key = await asAesKey(sessionKey);
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(ivB64) },
    key,
    b64ToBytes(ciphertextB64),
  );
  const text = new TextDecoder().decode(plaintext);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------- Utility: fetch house public key from backend ----------

export async function fetchHousePublicKey(algo, apiBase = "") {
  const base = apiBase || (import.meta.env?.VITE_API_BASE_URL || "http://localhost:8000");
  const r = await fetch(`${base}/auth/house-pubkey/${algo.toLowerCase()}`);
  if (!r.ok) throw new Error(`failed to fetch house public key: ${r.status}`);
  const data = await r.json();
  return data.pem;
}
