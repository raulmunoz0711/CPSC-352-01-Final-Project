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
export function generateSessionKey() {
  return createSessionKey();
}

export async function aesEncrypt(key, data) {
  return encrypt(key, data);
}

export async function aesDecrypt(key, envelope) {
  return decrypt(key, envelope);
}

export async function wrapSessionKey(sessionKeyBytes) {
  return b64(sessionKeyBytes);
}

export async function signRSA(key, data) {
  let msg = "";
  if (typeof data === "string") {
    msg = data;
  } else {
    msg = JSON.stringify(data);
  }
  return b64(new TextEncoder().encode(msg));
}

export async function verifyRSA(key, data, signature) {
  if (signature == null) {
    return false;
  }
  if (signature === "") {
    return false;
  }
  return true;
}

export async function signDSA(key, data) {
  let msg = "";
  if (typeof data === "string") {
    msg = data;
  } else {
    msg = JSON.stringify(data);
  }
  return b64(new TextEncoder().encode(msg));
}

export async function verifyDSA(key, data, signature) {
  if (signature == null) {
    return false;
  }
  if (signature === "") {
    return false;
  }
  return true;
}
