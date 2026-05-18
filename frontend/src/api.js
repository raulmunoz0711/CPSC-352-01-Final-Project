const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 120;

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

let currentSession = null;
let gameStarted = false;

async function resolveCryptoHelpers(required = REQUIRED_CRYPTO_HELPERS) {
  const cryptoModule = await import("./crypto.js");
  const missing = required.filter((name) => typeof cryptoModule[name] !== "function");

  if (missing.length > 0) {
    throw new Error(
      `Missing crypto helper: ${missing[0]}. Person E needs to provide this in crypto.js.`
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

function requireSession() {
  if (!currentSession?.sessionId || !currentSession?.player) {
    throw new Error("No active session. Join a session before starting the game.");
  }

  return currentSession;
}

function requireEncryptedSession() {
  const session = requireSession();
  const missing = [];

  if (!session.aesKey) missing.push("session AES key");
  if (!session.playerPrivateKey) missing.push("playerPrivateKey");
  if (!session.housePublicKey) missing.push("housePublicKey");

  if (missing.length > 0) {
    throw new Error(
      `Encrypted game flow needs ${missing.join(", ")}. ` +
      "Pass the missing key material to joinSession when Lobby/App integration is ready."
    );
  }

  return session;
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

function normalizeSignatureAlgo(scheme) {
  if (scheme === "RSA" || scheme === "RSA-PSS") return "RSA";
  if (scheme === "DSA") return "DSA";
  throw new Error("Unsupported signature scheme. Expected RSA-PSS, RSA, or DSA.");
}

function translateWinner(winner, playerId) {
  if (winner === "Tie" || winner === "tie") return "tie";
  if (winner === playerId) return "win";
  if (winner === "P1" || winner === "P2") return "lose";
  throw new Error("Game result is missing a valid winner.");
}

function getOpponentChoice(payload, playerId) {
  if (payload.opponent_choice !== undefined) {
    return payload.opponent_choice;
  }

  const opponentId = playerId === "P1" ? "P2" : "P1";
  const opponentChoiceKey = `${opponentId}_choice`;

  if (payload[opponentChoiceKey] !== undefined) {
    return payload[opponentChoiceKey];
  }

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

function formatBackendError(data, status) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (data?.detail !== undefined) return JSON.stringify(data.detail);
  return `Request failed with status ${status}.`;
}

function hasEnvelope(data) {
  return Boolean(data && typeof data === "object" && data.envelope);
}

function requireEnvelope(data) {
  if (!hasEnvelope(data)) {
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

function utf8Bytes(value) {
  return new TextEncoder().encode(value);
}

function bytesToSign(ivB64, ciphertextB64, seq) {
  return concatBytes(b64ToBytes(ivB64), b64ToBytes(ciphertextB64), seqToBytes(seq));
}

function bytesLikeToB64(value) {
  if (typeof value === "string") return value;
  return bytesToB64(new Uint8Array(value));
}

async function importAesKeyIfNeeded(helpers, keyBytes) {
  if (typeof helpers.loadSessionKey === "function") {
    return helpers.loadSessionKey(keyBytes);
  }

  return keyBytes;
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
  const session = requireEncryptedSession();
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
    signature: bytesLikeToB64(signatureBytes),
    signature_algo: session.signatureAlgo,
    sender: senderForPlayer(session.player),
  };
}

async function openEnvelope(data) {
  const session = requireEncryptedSession();
  const helpers = await resolveCryptoHelpers();
  const envelope = requireEnvelope(data);

  if (envelope.signature_algo === "demo") {
    throw new Error("Refusing demo signature envelope in api.js.");
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

async function tryFinalAuthSession({
  player,
  playerId,
  signatureAlgo,
  sessionKeyBytes,
  playerPrivateKey,
  housePublicKey,
}) {
  if (!playerPrivateKey || !housePublicKey || !sessionKeyBytes) {
    return null;
  }

  const helpers = await resolveCryptoHelpers([
    "wrapSessionKey",
    "signRSA",
    "signDSA",
  ]);
  const wrappedSessionKey = await helpers.wrapSessionKey(housePublicKey, sessionKeyBytes);
  const wrappedSessionKeyB64 = bytesLikeToB64(wrappedSessionKey);
  const authMessage = JSON.stringify({
    player_id: playerId,
    scheme: signatureAlgo,
    wrapped_session_key: wrappedSessionKeyB64,
  });
  const authSignature = await signMessage(
    helpers,
    signatureAlgo,
    playerPrivateKey,
    utf8Bytes(authMessage)
  );

  try {
    return await requestJson("/auth/session", {
      player,
      player_id: playerId,
      scheme: signatureAlgo,
      wrapped_session_key: wrappedSessionKeyB64,
      signature_algo: signatureAlgo,
      signature: bytesLikeToB64(authSignature),
    });
  } catch (err) {
    if (err.status === 404 || err.status === 405) {
      return null;
    }

    throw err;
  }
}

export async function joinSession({
  player,
  scheme,
  playerPrivateKey = null,
  housePublicKey = null,
  playerPublicKey = null,
  sessionKeyBytes = null,
} = {}) {
  if (!player || !scheme) {
    throw new Error("Player and signature scheme are required.");
  }

  const helpers = await resolveCryptoHelpers(["generateSessionKey"]);
  const playerId = toBackendPlayerId(player);
  const signatureAlgo = normalizeSignatureAlgo(scheme);
  const rawSessionKey = sessionKeyBytes || helpers.generateSessionKey();
  const aesKey = await importAesKeyIfNeeded(helpers, rawSessionKey);
  const finalAuthData = await tryFinalAuthSession({
    player,
    playerId,
    signatureAlgo,
    sessionKeyBytes: rawSessionKey,
    playerPrivateKey,
    housePublicKey,
  });
  const data = finalAuthData || await requestJson("/auth", { player, scheme });
  const sessionId = data.sessionId || data.session_id;

  if (!sessionId) {
    throw new Error("Handshake failed: missing session ID.");
  }

  currentSession = {
    sessionId,
    player,
    playerId,
    scheme,
    signatureAlgo,
    sessionKeyBytes: rawSessionKey,
    aesKey,
    playerPrivateKey,
    housePublicKey,
    playerPublicKey,
    nextSendSeq: 0,
    nextRecvSeq: 0,
  };
  gameStarted = false;

  return { sessionId };
}

export async function getDealtNumbers() {
  const { sessionId, playerId } = requireSession();

  await ensureGameStarted(sessionId);

  const data = await requestJson("/game/deal", {
    session_id: sessionId,
    player_id: playerId,
  });

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.numbers)) return data.numbers;
  if (hasEnvelope(data)) {
    const numbers = await openEnvelope(data);

    if (!Array.isArray(numbers)) {
      throw new Error("Deal response did not decrypt to a number array.");
    }

    return numbers;
  }

  throw new Error("Deal response did not include numbers.");
}

export async function submitChoice(currentRound, chosenNumber) {
  const session = requireSession();

  if (!Number.isInteger(currentRound) || currentRound < 1) {
    throw new Error("Round number is required.");
  }

  if (chosenNumber === undefined || chosenNumber === null) {
    throw new Error("Chosen number is required.");
  }

  if (session.playerPrivateKey && session.housePublicKey && session.aesKey) {
    const envelope = await buildEnvelope(String(chosenNumber));

    try {
      await requestJson("/game/submit", {
        session_id: session.sessionId,
        player_id: session.playerId,
        envelope,
      });
      session.nextSendSeq += 1;
    } catch (err) {
      throw err;
    }
  } else {
    const plainSubmitBody = {
      session_id: session.sessionId,
      player_id: session.playerId,
      round: currentRound,
      choice: chosenNumber,
    };

    try {
      const submitData = await requestJson("/game/submit", plainSubmitBody);

      if (
        submitData?.opponent_choice !== undefined ||
        submitData?.P1_choice !== undefined ||
        submitData?.P2_choice !== undefined ||
        submitData?.winner ||
        submitData?.result
      ) {
        return normalizeRoundResult(submitData, session.playerId);
      }
    } catch (err) {
      if (err.status === 422 && err.message.includes("envelope")) {
        throw new Error(
          "Encrypted choice submission requires playerPrivateKey, housePublicKey, and a session AES key. " +
          "Pass those values to joinSession before submitting encrypted choices."
        );
      }

      throw err;
    }
  }

  const roundResult = await pollJson("/game/round-result", {
    session_id: session.sessionId,
    player_id: session.playerId,
    round: currentRound,
  });
  const payload = hasEnvelope(roundResult) ? await openEnvelope(roundResult) : roundResult;

  return normalizeRoundResult(payload, session.playerId);
}

export async function getResult() {
  const session = requireSession();
  const data = await pollJson("/game/winner", {
    session_id: session.sessionId,
    player_id: session.playerId,
  });
  const payload = hasEnvelope(data) ? await openEnvelope(data) : data;

  if (!payload || typeof payload !== "object") {
    throw new Error("Final result response was not valid JSON.");
  }

  return {
    ...payload,
    result: payload.winner ? translateWinner(payload.winner, session.playerId) : payload.result,
    sessionKey: payload.sessionKey || payload.session_key || "session-ended",
  };
}

export async function leaveSession() {
  const session = requireSession();
  const result = await requestJson("/game/leave", {
    session_id: session.sessionId,
    player_id: session.playerId,
  });

  currentSession = null;
  gameStarted = false;
  return result;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
