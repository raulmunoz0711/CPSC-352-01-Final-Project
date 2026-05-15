const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 120;

let currentSession = null;
let gameStarted = false;

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
    const message = formatBackendError(data, response.status);
    const error = new Error(message);
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

function toBackendPlayerId(player) {
  if (player === "player1" || player === "P1") return "P1";
  if (player === "player2" || player === "P2") return "P2";
  throw new Error("Unknown player. Expected player1 or player2.");
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

function cryptoNotReadyError() {
  return new Error("Encrypted game response received, but frontend crypto helpers are not ready yet.");
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

function normalizeRoundResult(payload, playerId) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Round result response was not valid JSON.");
  }

  if (hasEnvelope(payload)) {
    throw cryptoNotReadyError();
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

export async function joinSession({ player, scheme }) {
  if (!player || !scheme) {
    throw new Error("Player and signature scheme are required.");
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ player, scheme }),
    });
  } catch (err) {
    throw new Error(`Handshake failed: ${err.message || "network error"}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Handshake failed: invalid JSON response.");
  }

  if (!response.ok) {
    throw new Error(data.error || data.detail || "Handshake failed.");
  }

  const sessionId = data.sessionId || data.session_id;
  if (!sessionId) {
    throw new Error("Handshake failed: missing session ID.");
  }

  currentSession = { sessionId, player, scheme };
  gameStarted = false;

  return { sessionId };
}

export async function getDealtNumbers() {
  const { sessionId, player } = requireSession();
  const playerId = toBackendPlayerId(player);

  await ensureGameStarted(sessionId);

  const data = await requestJson("/game/deal", {
    session_id: sessionId,
    player_id: playerId,
  });

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.numbers)) {
    return data.numbers;
  }

  if (hasEnvelope(data)) {
    throw cryptoNotReadyError();
  }

  throw new Error("Deal response did not include numbers.");
}

export async function submitChoice(currentRound, chosenNumber) {
  const { sessionId, player } = requireSession();
  const playerId = toBackendPlayerId(player);

  if (!Number.isInteger(currentRound) || currentRound < 1) {
    throw new Error("Round number is required.");
  }

  if (chosenNumber === undefined || chosenNumber === null) {
    throw new Error("Chosen number is required.");
  }

  const plainSubmitBody = {
    session_id: sessionId,
    player_id: playerId,
    round: currentRound,
    choice: chosenNumber,
  };

  let submitData;
  try {
    submitData = await requestJson("/game/submit", plainSubmitBody);
  } catch (err) {
    if (err.status === 422 && err.message.includes("envelope")) {
      throw cryptoNotReadyError();
    }

    throw err;
  }

  if (hasEnvelope(submitData)) {
    throw cryptoNotReadyError();
  }

  if (
    submitData?.opponent_choice !== undefined ||
    submitData?.P1_choice !== undefined ||
    submitData?.P2_choice !== undefined ||
    submitData?.winner ||
    submitData?.result
  ) {
    return normalizeRoundResult(submitData, playerId);
  }

  const roundResult = await pollJson("/game/round-result", {
    session_id: sessionId,
    player_id: playerId,
    round: currentRound,
  });

  return normalizeRoundResult(roundResult, playerId);
}

export async function getResult() {
  const { sessionId, player } = requireSession();
  const playerId = toBackendPlayerId(player);

  const data = await pollJson("/game/winner", {
    session_id: sessionId,
    player_id: playerId,
  });

  if (hasEnvelope(data)) {
    throw cryptoNotReadyError();
  }

  if (!data || typeof data !== "object") {
    throw new Error("Final result response was not valid JSON.");
  }

  return {
    ...data,
    result: data.winner ? translateWinner(data.winner, playerId) : data.result,
    sessionKey: data.sessionKey || data.session_key || "session-ended",
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
