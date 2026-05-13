const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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

  return { sessionId };
}
