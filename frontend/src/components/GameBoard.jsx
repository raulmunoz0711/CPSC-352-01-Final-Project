import { useState, useEffect } from "react";
import * as api from "../api";

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
    border: "none",
    borderRadius: "4px",
    padding: "1.75rem",
    marginBottom: "1rem",
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
  roundTrack: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "1.25rem",
  },
  roundLine: { flex: 1, height: "1px", background: "#2a2a2a" },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.45rem",
  },
  infoLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.62rem",
    color: "#888880",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  infoValue: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.75rem",
    color: "#e8e0d0",
  },
  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "0.75rem",
    margin: "1.25rem 0",
  },
  numCardBase: {
    background: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: "2px",
    padding: "1.25rem 0.5rem",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
  },
  numCardSelected: {
    borderColor: "#c9a84c",
    background: "rgba(201,168,76,0.08)",
  },
  numVal: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "2rem",
    color: "#e8c96a",
    display: "block",
  },
  numLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.58rem",
    color: "#888880",
    marginTop: "0.2rem",
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
  cryptoLog: {
    background: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: "2px",
    padding: "0.75rem 1rem",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.65rem",
    color: "#888880",
    marginTop: "1rem",
    maxHeight: "120px",
    overflowY: "auto",
    lineHeight: "1.9",
    whiteSpace: "pre-wrap",
  },
  logOk:   { color: "#4caf7d" },
  logInfo: { color: "#c9a84c" },
  logErr:  { color: "#e57373" },
  badge: {
    display: "inline-block",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.58rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "0.2rem 0.5rem",
    borderRadius: "2px",
  },
  badgeWin:  { background: "rgba(39,174,96,0.15)",  color: "#4caf7d", border: "1px solid rgba(39,174,96,0.3)"  },
  badgeLose: { background: "rgba(192,57,43,0.15)",  color: "#e57373", border: "1px solid rgba(192,57,43,0.3)"  },
  badgeTie:  { background: "rgba(201,168,76,0.15)", color: "#c9a84c", border: "1px solid rgba(201,168,76,0.3)" },
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
};

function RoundPip({ number, state }) {
  const pip = {
    width: "28px", height: "28px",
    borderRadius: "50%",
    border: "1px solid",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.62rem",
    flexShrink: 0,
    borderColor: state === "done" || state === "active" ? "#c9a84c" : "#2a2a2a",
    color:       state === "done" || state === "active" ? "#e8c96a" : "#888880",
    background:  state === "done" ? "rgba(201,168,76,0.15)" : "transparent",
  };
  return <div style={pip}>{number}</div>;
}

/**
 * GameBoard
 *
 * Props:
 *   onGameOver {function} called after round 3 with:
 *     { playerScore, opponentScore, roundHistory, sessionKey }
 */
export default function GameBoard({ onGameOver = () => {} }) {
  const [currentRound,  setCurrentRound]  = useState(1);
  const [numbers,       setNumbers]       = useState([]);
  const [selectedIdx,   setSelectedIdx]   = useState(null); // track by INDEX not value
  const [playerScore,   setPlayerScore]   = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [lastResult,    setLastResult]    = useState(null);
  const [roundHistory,  setRoundHistory]  = useState([]);
  const [isWaiting,     setIsWaiting]     = useState(false);
  const [isLoadingNums, setIsLoadingNums] = useState(true);
  const [log,           setLog]           = useState([]);
  const [error,         setError]         = useState(null);

  // Fetch numbers from house at the start of each round
  useEffect(() => {
    setIsLoadingNums(true);
    setSelectedIdx(null);
    setLog([]);
    setError(null);

    api.getDealtNumbers()
      .then((nums) => {
        setNumbers(nums);
        setIsLoadingNums(false);
      })
      .catch((err) => {
        // Could be a signature verification failure from api.js
        setError(err.message || "Failed to receive numbers from house.");
        setIsLoadingNums(false);
      });
  }, [currentRound]);

  function addLog(type, msg) {
    setLog(prev => [...prev, { type, msg }]);
  }

  async function handleSubmit() {
    if (selectedIdx === null || isWaiting || isLoadingNums) return;

    const chosenNumber = numbers[selectedIdx];
    setIsWaiting(true);
    setError(null);

    addLog("info", `Signing choice (${chosenNumber})…`);
    addLog("info", "Encrypting with AES-GCM session key → sending…");

    try {
      // api.js handles signing + encrypting the envelope
      const { oppPick, result } = await api.submitChoice(currentRound, chosenNumber);

      addLog("ok", "  ✓ House received & verified your choice");
      addLog(
        result === "win" ? "ok" : "info",
        `  You(${chosenNumber}) vs Opp(${oppPick}) → ${result.toUpperCase()}`
      );

      const newPlayerScore   = playerScore   + (result === "win"  ? 1 : 0);
      const newOpponentScore = opponentScore + (result === "lose" ? 1 : 0);
      const newHistory = [
        ...roundHistory,
        { round: currentRound, mine: chosenNumber, opp: oppPick, result },
      ];

      setPlayerScore(newPlayerScore);
      setOpponentScore(newOpponentScore);
      setRoundHistory(newHistory);
      setLastResult(result);
      setIsWaiting(false);

      await delay(800);

      if (currentRound < 3) {
        setCurrentRound(r => r + 1);
      } else {
        // All 3 rounds done — get final result (api.js verifies house signature)
        try {
          const finalResult = await api.getResult();
          onGameOver({
            playerScore:   newPlayerScore,
            opponentScore: newOpponentScore,
            roundHistory:  newHistory,
            sessionKey:    finalResult.sessionKey || "session-ended",
          });
        } catch (err) {
          // Never display unverified results
          setError(
            err.message === "signature verification failed"
              ? "⚠ Winner announcement could not be verified. Signature check failed."
              : err.message || "Failed to retrieve final result."
          );
          setIsWaiting(false);
        }
      }
    } catch (err) {
      // api.js threw — could be signature verification failure or network error
      addLog("err", `  ✗ ${err.message}`);
      setError(
        err.message === "signature verification failed"
          ? "⚠ Server response could not be verified. Signature check failed."
          : err.message || "Something went wrong. Please try again."
      );
      setIsWaiting(false);
    }
  }

  const resultBadge =
    lastResult === "win"  ? <span style={{ ...styles.badge, ...styles.badgeWin  }}>You Won</span>  :
    lastResult === "lose" ? <span style={{ ...styles.badge, ...styles.badgeLose }}>You Lost</span> :
    lastResult === "tie"  ? <span style={{ ...styles.badge, ...styles.badgeTie  }}>Tie</span>      :
    null;

  return (
    <div style={styles.wrapper}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <div style={styles.container}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoSuit}>♠ ♥ ♦ ♣</div>
          <h1 style={styles.logoH1}>Secure Poker</h1>
          <p style={styles.logoSub}>CPSC 352 · Cryptographic Protocol</p>
        </div>

        {/* Error banner — shown when api.js throws signature verification failure */}
        {error && (
          <div style={styles.errorBanner}>⚠ {error}</div>
        )}

        {/* Round tracker */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Round Progress</div>
          <div style={styles.roundTrack}>
            {[1, 2, 3].map((n, i) => (
              <div key={n} style={{ display: "contents" }}>
                <RoundPip
                  number={n}
                  state={n < currentRound ? "done" : n === currentRound ? "active" : "idle"}
                />
                {i < 2 && <div style={styles.roundLine} />}
              </div>
            ))}
          </div>

          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Round</span>
            <span style={styles.infoValue}>{currentRound} of 3</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Your wins</span>
            <span style={styles.infoValue}>{playerScore}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Opponent wins</span>
            <span style={styles.infoValue}>{opponentScore}</span>
          </div>
          {lastResult && (
            <div style={{ ...styles.infoRow, marginTop: "0.5rem" }}>
              <span style={styles.infoLabel}>Last round</span>
              {resultBadge}
            </div>
          )}
        </div>

        {/* Number picker */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Your Numbers — Choose One</div>
          <p style={{ fontSize: "0.68rem", color: "#888880", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "0.25rem" }}>
            House sent these numbers (AES-GCM encrypted + signed). Pick wisely.
          </p>

          <div style={styles.numberGrid}>
            {isLoadingNums
              ? [0, 1, 2].map(i => (
                  <div key={i} style={{ ...styles.numCardBase, opacity: 0.4 }}>
                    <span style={styles.numVal}>—</span>
                    <span style={styles.numLabel}>loading…</span>
                  </div>
                ))
              : numbers.map((n, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.numCardBase,
                      ...(selectedIdx === i ? styles.numCardSelected : {}),
                    }}
                    onClick={() => !isWaiting && setSelectedIdx(i)}
                  >
                    <span style={styles.numVal}>{n}</span>
                    <span style={styles.numLabel}>{selectedIdx === i ? "selected" : "tap to pick"}</span>
                  </div>
                ))
            }
          </div>

          <button
            style={{
              ...styles.btn,
              ...(selectedIdx === null || isWaiting || isLoadingNums ? styles.btnDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={selectedIdx === null || isWaiting || isLoadingNums}
          >
            {isWaiting ? "⏳  Waiting for opponent…" : "Submit Choice"}
          </button>

          {log.length > 0 && (
            <div style={styles.cryptoLog}>
              {log.map((l, i) => (
                <span key={i} style={l.type === "ok" ? styles.logOk : l.type === "err" ? styles.logErr : styles.logInfo}>
                  {l.msg}{"\n"}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }