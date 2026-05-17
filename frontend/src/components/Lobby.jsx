import { useState } from "react";

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "#0a0a0a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'IBM Plex Sans', sans-serif",
    padding: "2rem 1rem",
  },
  container: { width: "100%", maxWidth: "540px" },
  logo: { textAlign: "center", marginBottom: "2rem" },
  logoSuit: { fontSize: "1.2rem", color: "#c9a84c", letterSpacing: "0.5rem" },
  logoH1: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "1.8rem",
    color: "#e8c96a",
    margin: "0.2rem 0 0.1rem",
  },
  logoSub: {
    fontSize: "0.65rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#888880",
    fontFamily: "'IBM Plex Mono', monospace",
  },
  panel: {
    background: "#181818",
    borderRadius: "4px",
    padding: "1.75rem",
    marginBottom: "1rem",
    border: "none",
  },
  panelTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.62rem",
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    color: "#c9a84c",
    borderBottom: "1px solid #2a2a2a",
    paddingBottom: "0.65rem",
    marginBottom: "1.25rem",
  },
  optionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.75rem",
  },
  optionBtn: (active) => ({
    background: active ? "rgba(201,168,76,0.08)" : "#111111",
    border: `1px solid ${active ? "#c9a84c" : "#2a2a2a"}`,
    borderRadius: "2px",
    padding: "1rem 0.75rem",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
    fontFamily: "'IBM Plex Mono', monospace",
    color: active ? "#e8c96a" : "#888880",
  }),
  optionIcon: {
    fontSize: "1.3rem",
    display: "block",
    marginBottom: "0.4rem",
    color: "#c9a84c",
  },
  optionLabel: {
    fontSize: "0.72rem",
    letterSpacing: "0.1em",
    display: "block",
  },
  optionSub: {
    fontSize: "0.58rem",
    color: "#555550",
    display: "block",
    marginTop: "0.2rem",
    letterSpacing: "0.08em",
  },
  fileInput: {
    display: "block",
    width: "100%",
    padding: "0.65rem",
    background: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: "2px",
    color: "#888880",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.65rem",
    cursor: "pointer",
  },
  fileLoaded: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.6rem",
    color: "#4caf7d",
    marginTop: "0.4rem",
  },
  errorBanner: {
    background: "rgba(192,57,43,0.08)",
    border: "1px solid rgba(192,57,43,0.3)",
    borderRadius: "2px",
    color: "#e57373",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.65rem",
    padding: "0.6rem 0.85rem",
    marginBottom: "1rem",
    letterSpacing: "0.05em",
  },
  btn: {
    display: "block",
    width: "100%",
    padding: "0.85rem",
    background: "transparent",
    border: "1px solid #c9a84c",
    color: "#e8c96a",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.72rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    cursor: "pointer",
    borderRadius: "2px",
    marginTop: "0.5rem",
  },
  btnDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  finePrint: {
    textAlign: "center",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.58rem",
    color: "#3a3a38",
    letterSpacing: "0.08em",
    marginTop: "0.75rem",
  },
};

export default function Lobby({ onJoin = () => {} }) {
  const [player, setPlayer] = useState(null);
  const [scheme, setScheme] = useState(null);
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [keyFileName, setKeyFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = player && scheme && privateKeyPem && !loading;

  function handleKeyFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      if (!text.includes("BEGIN") || !text.includes("PRIVATE KEY")) {
        setError("File does not look like a PEM private key.");
        setPrivateKeyPem("");
        setKeyFileName("");
        return;
      }
      setPrivateKeyPem(text);
      setKeyFileName(file.name);
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setPrivateKeyPem("");
      setKeyFileName("");
    };
    reader.readAsText(file);
  }

  async function handleJoin() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      await onJoin({ player, scheme, privateKeyPem });
    } catch (err) {
      setError(err.message || "Handshake failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div style={styles.container}>
        <div style={styles.logo}>
          <div style={styles.logoSuit}>♠ ♥ ♦ ♣</div>
          <h1 style={styles.logoH1}>Secure Poker</h1>
          <p style={styles.logoSub}>CPSC 352 · Cryptographic Protocol</p>
        </div>

        {/* Player select */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Select Player</div>
          <div style={styles.optionGrid}>
            {[
              { id: "player1", icon: "♠", label: "Player 1", sub: "First to connect" },
              { id: "player2", icon: "♣", label: "Player 2", sub: "Second to connect" },
            ].map((p) => (
              <div
                key={p.id}
                style={styles.optionBtn(player === p.id)}
                onClick={() => setPlayer(p.id)}
              >
                <span style={styles.optionIcon}>{p.icon}</span>
                <span style={styles.optionLabel}>{p.label}</span>
                <span style={styles.optionSub}>{p.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signature scheme select */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Signature Scheme</div>
          <div style={styles.optionGrid}>
            {[
              { id: "RSA", icon: "🔐", label: "RSA-PSS", sub: "PKCS #1 v2.1" },
              { id: "DSA", icon: "🔏", label: "DSA", sub: "FIPS 186" },
            ].map((s) => (
              <div
                key={s.id}
                style={styles.optionBtn(scheme === s.id)}
                onClick={() => setScheme(s.id)}
              >
                <span style={styles.optionIcon}>{s.icon}</span>
                <span style={styles.optionLabel}>{s.label}</span>
                <span style={styles.optionSub}>{s.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Private key file picker */}
        {scheme && player && (
          <div style={styles.panel}>
            <div style={styles.panelTitle}>
              Load Your Private Key ({player}_{scheme.toLowerCase()}.priv)
            </div>
            <input
              type="file"
              accept=".priv,.pem,.key"
              onChange={handleKeyFile}
              style={styles.fileInput}
            />
            {keyFileName && (
              <div style={styles.fileLoaded}>✓ Loaded: {keyFileName}</div>
            )}
          </div>
        )}

        {/* Error */}
        {error && <div style={styles.errorBanner}>⚠ {error}</div>}

        {/* Submit */}
        <button
          style={{ ...styles.btn, ...(canSubmit ? {} : styles.btnDisabled) }}
          onClick={handleJoin}
          disabled={!canSubmit}
          type="button"
        >
          {loading ? "⏳  Connecting…" : "Enter the Table"}
        </button>

        <p style={styles.finePrint}>
          Private key held in memory only — never persisted.
        </p>
      </div>
    </div>
  );
}
