import { KEYUTIL, KJUR, hextob64 } from "jsrsasign";

const subtle = window.crypto.subtle;

function b64(buffer) {
  let bytes = new Uint8Array(buffer);
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str);
}

function fromB64(str) {
  let raw = atob(str);
  let bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function pemToBytes(pem) {
  let clean = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s/g, "");
  return fromB64(clean);
}

async function importRsaPublicKey(pem) {
  if (pem && pem.type === "public") {
    return pem;
  }
  return subtle.importKey(
    "spki",
    pemToBytes(pem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

async function importRsaPrivateKey(pem) {
  if (pem && pem.type === "private") {
    return pem;
  }
  return subtle.importKey(
    "pkcs8",
    pemToBytes(pem),
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function importRsaVerifyKey(pem) {
  if (pem && pem.type === "public") {
    return pem;
  }
  return subtle.importKey(
    "spki",
    pemToBytes(pem),
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

export function createSessionKey() {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function loadSessionKey(keyBytes) {
  return subtle.importKey(
    "raw",
    keyBytes,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(key, data) {
  let iv = crypto.getRandomValues(new Uint8Array(12));
  let msg = "";
  if (typeof data === "string") {
    msg = data;
  } else {
    msg = JSON.stringify(data);
  }
  let encrypted = await subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    new TextEncoder().encode(msg)
  );
  return {
    ciphertext: b64(encrypted),
    iv: b64(iv),
  };
}

export async function decrypt(key, envelope) {
  let plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(envelope.iv) },
    key,
    fromB64(envelope.ciphertext)
  );
  let msg = new TextDecoder().decode(plaintext);
  try {
    return JSON.parse(msg);
  } catch {
    return msg;
  }
}


export async function makeEnvelope(key, data, seq, sender) {
  let encrypted = await encrypt(key, data);
  let signatureText = sender + ":" + seq;
  return {
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    seq: seq,
    signature: b64(new TextEncoder().encode(signatureText)),
    signature_algo: "demo",
    sender: sender,
  };
}

export function verifyEnvelope(envelope) {
  if (envelope == null) {
    return false;
  }
  if (!envelope.ciphertext) {
    return false;
  }
  if (!envelope.iv) {
    return false;
  }
  if (!envelope.signature) {
    return false;
  }
  return true;
}

export function clearSessionKey(keyBytes) {
  keyBytes.fill(0);
}

function isBytes(value) {
  return value instanceof Uint8Array || value instanceof ArrayBuffer;
}

function getBytes(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }
  return new TextEncoder().encode(JSON.stringify(value));
}

async function getAesKey(key) {
  if (key && key.type === "secret") {
    return key;
  }
  return loadSessionKey(key);
}

export function generateSessionKey() {
  return createSessionKey();
}

export async function aesEncrypt(key, data) {
  let aesKey = await getAesKey(key);
  return encrypt(aesKey, data);
}

export async function aesDecrypt(key, iv, ciphertext) {
  let aesKey = await getAesKey(key);
  return decrypt(aesKey, {
    iv: iv,
    ciphertext: ciphertext,
  });
}

export async function wrapSessionKey(housePublicKey, sessionKeyBytes) {
  let pubKey = await importRsaPublicKey(housePublicKey);
  let wrapped = await subtle.encrypt(
    { name: "RSA-OAEP" },
    pubKey,
    sessionKeyBytes
  );
  return b64(wrapped);
}

export async function signRSA(privateKey, data) {
  let privKey = await importRsaPrivateKey(privateKey);
  let signature = await subtle.sign(
    { name: "RSA-PSS", saltLength: 222 },
    privKey,
    getBytes(data)
  );
  return b64(signature);
}

export async function verifyRSA(publicKey, data, signature) {
  let pubKey = await importRsaVerifyKey(publicKey);
  return subtle.verify(
    { name: "RSA-PSS", saltLength: 222 },
    pubKey,
    isBytes(signature) ? signature : fromB64(signature),
    getBytes(data)
  );
}

export async function signDSA(privatePem, data) {
  let privateKey = KEYUTIL.getKey(privatePem);
  let sig = new KJUR.crypto.Signature({ alg: "SHA256withDSA" });
  sig.init(privateKey);

  if (typeof data === "string") {
    sig.updateString(data);
  } else {
    sig.updateHex(bytesToHex(getBytes(data)));
  }

  let sigHex = sig.sign();
  return hextob64(sigHex);
}

export async function verifyDSA(publicPem, data, signature) {
  let publicKey = KEYUTIL.getKey(publicPem);
  let sig = new KJUR.crypto.Signature({ alg: "SHA256withDSA" });
  sig.init(publicKey);

  if (typeof data === "string") {
    sig.updateString(data);
  } else {
    sig.updateHex(bytesToHex(getBytes(data)));
  }

  let sigHex = isBytes(signature)
    ? bytesToHex(signature)
    : bytesToHex(fromB64(signature));

  return sig.verify(sigHex);
}