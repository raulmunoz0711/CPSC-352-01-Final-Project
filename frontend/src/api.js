const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 120;

let currentSession = null;
let gameStarted = false;

const REQUIRED_CRYPTO_HELPERS = [
  "generateSessionKey",
  "wrapSessionKey",
  "signRSA",
  "signDSA",
  "verifyRSA",
  "verifyDSA",
  "aesEncrypt",
  "aesDecrypt",
];

async function resolveCryptoHelpers() {
  const cryptoModule = await import("./crypto.js");
  const missing = REQUIRED_CRYPTO_HELPERS.filter((name) => typeof cryptoModule[name] !== "function");

  if (missing.length > 0) {
    throw new Error(
      `Final crypto helpers are missing from crypto.js: ${missing.join(", ")}. ` +
      "Do not use demo envelopes for the final protocol."
    );
  }

  return cryptoModule;
}

async function requestJson(path, body, options = {}) {
  const { allowAccepted = false } = options;
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Request failed: ${err.message || "network error"}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Request failed: invalid JSON response.");
  }

  if (allowAccepted && response.status === 202) {
    return { accepted: true, data };
  }

  if (!response.ok) {
    const error = new Error(formatBackendError(data, response.status));
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function pollJson(path, body) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const result = await requestJson(path, body, { allowAccepted: true });

    if (!result.accepted) {
      return result;
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for game result.");
}

function formatBackendError(data, status) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (data?.detail !== undefined) return JSON.stringify(data.detail);
  return `Request failed with status ${status}.`;
}

function requireSession() {
  if (!currentSession?.sessionId || !currentSession?.player || !currentSession?.aesKey) {
    throw new Error("No active encrypted session. Complete the auth/session handshake first.");
  }

  return currentSession;
}

function normalizeSignatureAlgo(scheme) {
  if (scheme === "RSA" || scheme === "RSA-PSS") return "RSA";
  if (scheme === "DSA") return "DSA";
  throw new Error("Unsupported signature scheme. Expected RSA-PSS, RSA, or DSA.");
}

function toBackendPlayerId(player) {
  if (player === "player1" || player === "P1") return "P1";
  if (player === "player2" || player === "P2") return "P2";
  throw new Error("Unknown player. Expected player1 or player2.");
}

function senderForPlayer(player) {
  if (player === "player1" || player === "P1") return "player1";
  if (player === "player2" || player === "P2") return "player2";
  throw new Error("Unknown player. Expected player1 or player2.");
}

function translateWinner(winner, playerId) {
  if (winner === "Tie" || winner === "tie") return "tie";
  if (winner === playerId) return "win";
  if (winner === "P1" || winner === "P2") return "lose";
  throw new Error("Game result is missing a valid winner.");
}

function getOpponentChoice(payload, playerId) {
  if (payload.opponent_choice !== undefined) return payload.opponent_choice;

  const opponentId = playerId === "P1" ? "P2" : "P1";
  const opponentChoiceKey = `${opponentId}_choice`;

  if (payload[opponentChoiceKey] !== undefined) return payload[opponentChoiceKey];
  throw new Error("Round result is missing opponent choice.");
}

function normalizeRoundResult(payload, playerId) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Round result response was not valid JSON.");
  }

  const winner = payload.winner || payload.result;
  const result = winner === "win" || winner === "lose" || winner === "tie"
    ? winner
    : translateWinner(winner, playerId);

  return {
    oppPick: getOpponentChoice(payload, playerId),
    result,
  };
}

function requireEnvelope(data) {
  if (!data || typeof data !== "object" || !data.envelope) {
    throw new Error("Expected encrypted envelope response from backend.");
  }

  return data.envelope;
}

function b64ToBytes(value) {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }

  return bytes;
}

function bytesToB64(bytes) {
  let raw = "";

  for (let i = 0; i < bytes.length; i += 1) {
    raw += String.fromCharCode(bytes[i]);
  }

  return btoa(raw);
}

function seqToBytes(seq) {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, seq, false);
  return bytes;
}

function concatBytes(...parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function bytesToSign(ivB64, ciphertextB64, seq) {
  return concatBytes(b64ToBytes(ivB64), b64ToBytes(ciphertextB64), seqToBytes(seq));
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value);
}

async function signMessage(helpers, signatureAlgo, privateKey, messageBytes) {
  if (signatureAlgo === "RSA") return helpers.signRSA(privateKey, messageBytes);
  if (signatureAlgo === "DSA") return helpers.signDSA(privateKey, messageBytes);
  throw new Error("Unsupported signature algorithm.");
}

async function verifyMessage(helpers, signatureAlgo, publicKey, messageBytes, signatureBytes) {
  if (signatureAlgo === "RSA") return helpers.verifyRSA(publicKey, messageBytes, signatureBytes);
  if (signatureAlgo === "DSA") return helpers.verifyDSA(publicKey, messageBytes, signatureBytes);
  throw new Error("Unsupported signature algorithm.");
}

async function buildEnvelope(plaintext) {
  const session = requireSession();
  const helpers = await resolveCryptoHelpers();
  const seq = session.nextSendSeq;
  const encrypted = await helpers.aesEncrypt(session.aesKey, plaintext);
  const messageBytes = bytesToSign(encrypted.iv, encrypted.ciphertext, seq);
  const signatureBytes = await signMessage(
    helpers,
    session.signatureAlgo,
    session.playerPrivateKey,
    messageBytes
  );

  return {
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    seq,
    signature: typeof signatureBytes === "string" ? signatureBytes : bytesToB64(new Uint8Array(signatureBytes)),
    signature_algo: session.signatureAlgo,
    sender: senderForPlayer(session.player),
  };
}

async function openEnvelope(data) {
  const session = requireSession();
  const helpers = await resolveCryptoHelpers();
  const envelope = requireEnvelope(data);

  if (envelope.signature_algo === "demo") {
    throw new Error("Refusing demo signature envelope in final API implementation.");
  }

  if (envelope.seq !== session.nextRecvSeq) {
    throw new Error(`replay or out-of-order: got seq=${envelope.seq}, expected ${session.nextRecvSeq}`);
  }

  const messageBytes = bytesToSign(envelope.iv, envelope.ciphertext, envelope.seq);
  const signatureBytes = b64ToBytes(envelope.signature);
  const valid = await verifyMessage(
    helpers,
    envelope.signature_algo,
    session.housePublicKey,
    messageBytes,
    signatureBytes
  );

  if (!valid) {
    throw new Error("signature verification failed");
  }

  const plaintext = await helpers.aesDecrypt(session.aesKey, envelope.iv, envelope.ciphertext);
  session.nextRecvSeq += 1;
  return plaintext;
}

async function ensureGameStarted(sessionId) {
  if (gameStarted) return;

  try {
    await requestJson("/game/start", { session_id: sessionId });
    gameStarted = true;
  } catch (err) {
    if (err.message.includes("game already started")) {
      gameStarted = true;
      return;
    }

    throw err;
  }
}

export async function joinSession({
  player,
  scheme,
  playerPrivateKey,
  housePublicKey,
  sessionKeyBytes,
} = {}) {
  if (!player || !scheme) {
    throw new Error("Player and signature scheme are required.");
  }

  if (!playerPrivateKey || !housePublicKey) {
    throw new Error(
      "Final joinSession requires playerPrivateKey and housePublicKey from Lobby/App integration."
    );
  }

  const helpers = await resolveCryptoHelpers();
  const signatureAlgo = normalizeSignatureAlgo(scheme);
  const rawSessionKey = sessionKeyBytes || await helpers.generateSessionKey();

  const wrappedSessionKey = await helpers.wrapSessionKey(housePublicKey, rawSessionKey);
  const wrappedSessionKeyB64 = typeof wrappedSessionKey === "string"
    ? wrappedSessionKey
    : bytesToB64(new Uint8Array(wrappedSessionKey));
  // Sign the raw wrapped-session-key bytes.
  const wrappedBytes = b64ToBytes(wrappedSessionKeyB64);
  const authSignature = await signMessage(
    helpers,
    signatureAlgo,
    playerPrivateKey,
    wrappedBytes
  );
  const authBody = {
    player,
    player_id: toBackendPlayerId(player),
    scheme: signatureAlgo,
    wrapped_session_key: wrappedSessionKeyB64,
    signature_algo: signatureAlgo,
    signature: typeof authSignature === "string"
      ? authSignature
      : bytesToB64(new Uint8Array(authSignature)),
  };

  const data = await requestJson("/auth/session", authBody);
  const sessionId = data.sessionId || data.session_id;

  if (!sessionId) {
    throw new Error("Handshake failed: missing session ID.");
  }

  currentSession = {
    sessionId,
    player,
    playerId: toBackendPlayerId(player),
    signatureAlgo,
    sessionKeyBytes: rawSessionKey,
    aesKey: rawSessionKey,
    playerPrivateKey,
    housePublicKey,
    nextSendSeq: 0,
    nextRecvSeq: 0,
  };
  gameStarted = false;

  return { sessionId };
}

export async function waitForBothPlayers(sessionId, intervalMs = 500, maxAttempts = 240) {
  for (let i = 0; i < maxAttempts; i++) {
    const r = await fetch(`${API_BASE}/auth/status/${sessionId}`);
    const data = await r.json();
    if (data.both_ready) return;
    await new Promise(res => setTimeout(res, intervalMs));
  }
  throw new Error("Timed out waiting for second player.");
}

export async function getDealtNumbers() {
  const { sessionId, playerId } = requireSession();

  await ensureGameStarted(sessionId);

  const data = await requestJson("/game/deal", {
    session_id: sessionId,
    player_id: playerId,
  });
  const numbers = await openEnvelope(data);

  if (!Array.isArray(numbers)) {
    throw new Error("Deal response did not decrypt to a number array.");
  }

  return numbers;
}

export async function submitChoice(currentRound, chosenNumber) {
  const session = requireSession();

  if (!Number.isInteger(currentRound) || currentRound < 1) {
    throw new Error("Round number is required.");
  }

  if (chosenNumber === undefined || chosenNumber === null) {
    throw new Error("Chosen number is required.");
  }

  const envelope = await buildEnvelope(String(chosenNumber));

  await requestJson("/game/submit", {
    session_id: session.sessionId,
    player_id: session.playerId,
    envelope,
  });
  session.nextSendSeq += 1;
  
  const roundResultEnvelope = await pollJson("/game/round-result", {
    session_id: session.sessionId,
    player_id: session.playerId,
    round: currentRound,
  });
  const roundResult = await openEnvelope(roundResultEnvelope);

  return normalizeRoundResult(roundResult, session.playerId);
}

export async function getResult() {
  const session = requireSession();
  const data = await pollJson("/game/winner", {
    session_id: session.sessionId,
    player_id: session.playerId,
  });
  const payload = await openEnvelope(data);

  if (!payload || typeof payload !== "object") {
    throw new Error("Final result response was not valid JSON.");
  }

  return {
    ...payload,
    result: payload.winner ? translateWinner(payload.winner, session.playerId) : payload.result,
    sessionKey: "session-ended",
  };
}

export async function leaveSession() {
  // Clear local state first so it always happens, even if the backend
  // already destroyed this session (404) or the request fails for any reason.
  const session = currentSession;
  currentSession = null;
  gameStarted = false;

  if (!session?.sessionId) return { status: "no active session" };

  try {
    return await requestJson("/game/leave", {
      session_id: session.sessionId,
      player_id: session.playerId,
    });
  } catch (err) {
    // Session was already gone or unreachable — local state is already cleared.
    return { status: "session already destroyed" };
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
