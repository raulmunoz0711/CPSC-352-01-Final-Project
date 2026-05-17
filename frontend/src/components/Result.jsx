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
      border: "1px solid #2a2a2a",
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
    winnerBanner: (won, tie) => ({
      textAlign: "center",
      padding: "2rem 1rem",
      border: `1px solid ${tie ? "#888880" : won ? "#c9a84c" : "#c0392b"}`,
      background: tie
        ? "rgba(136,136,128,0.05)"
        : won
        ? "rgba(201,168,76,0.05)"
        : "rgba(192,57,43,0.05)",
      borderRadius: "2px",
      marginBottom: "1rem",
    }),
    suitRow: { fontSize: "1.4rem", letterSpacing: "0.4rem", color: "#c9a84c", marginBottom: "0.75rem" },
    winnerName: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "1.6rem",
      color: "#e8c96a",
      marginBottom: "0.3rem",
    },
    winnerSub: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "0.68rem",
      color: "#888880",
    },
    table: { width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem" },
    th: {
      textAlign: "left",
      color: "#888880",
      fontSize: "0.58rem",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      padding: "0 0 0.65rem",
      borderBottom: "1px solid #2a2a2a",
    },
    td: { padding: "0.55rem 0", borderBottom: "1px solid #1e1e1e", color: "#e8e0d0" },
    win:  { color: "#4caf7d" },
    lose: { color: "#e57373" },
    tie:  { color: "#c9a84c" },
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
    badge: {
      display: "inline-block",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "0.58rem",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "0.2rem 0.5rem",
      borderRadius: "2px",
      background: "rgba(192,57,43,0.15)",
      color: "#e57373",
      border: "1px solid rgba(192,57,43,0.3)",
    },
    note: {
      fontSize: "0.65rem",
      color: "#888880",
      fontFamily: "'IBM Plex Mono', monospace",
      marginTop: "0.75rem",
      lineHeight: "1.7",
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
  };

  export default function Result({
    playerName    = "Player 1",
    roundHistory  = [],
    playerScore   = 0,
    opponentScore = 0,
    sessionKey    = "session-ended",
    onPlayAgain   = () => {},
  }) {
    const playerWon = playerScore > opponentScore;
    const tie       = playerScore === opponentScore;

    const winnerLabel = tie
      ? "Draw"
      : playerWon
      ? `${playerName} Wins!`
      : "Opponent Wins";

    const winnerSub = tie
      ? "Both players won the same number of rounds."
      : playerWon
      ? `Won ${playerScore} of 3 rounds`
      : `Opponent won ${opponentScore} of 3 rounds`;

    // Session key display: if backend returned the sentinel "session-ended",
    // just show "—" since the key was never meant to be visible.
    const sessionKeyDisplay = sessionKey === "session-ended" ? "—" : sessionKey;

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

          {/* Winner banner */}
          <div style={styles.winnerBanner(playerWon, tie)}>
            <div style={styles.suitRow}>♠ ♥ ♦ ♣</div>
            <h2 style={styles.winnerName}>{winnerLabel}</h2>
            <p style={styles.winnerSub}>{winnerSub}</p>
          </div>

          {/* Round summary */}
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Round Summary</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Round</th>
                  <th style={styles.th}>Your pick</th>
                  <th style={styles.th}>Opponent</th>
                  <th style={styles.th}>Result</th>
                </tr>
              </thead>
              <tbody>
                {roundHistory.map((r) => (
                  <tr key={r.round}>
                    <td style={styles.td}>Round {r.round}</td>
                    <td style={styles.td}>{r.mine}</td>
                    <td style={styles.td}>{r.opp}</td>
                    <td style={{ ...styles.td, ...(r.result === "win" ? styles.win : r.result === "lose" ? styles.lose : styles.tie) }}>
                      {r.result.toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Session teardown */}
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Session Teardown</div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Session key</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#888880" }}>{sessionKeyDisplay}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Key status</span>
              <span style={styles.badge}>Destroyed</span>
            </div>
            <p style={styles.note}>
              Session key has been securely wiped from memory. No forward secrets remain.
            </p>
          </div>

          <button style={styles.btn} onClick={onPlayAgain}>
            Play Again
          </button>
        </div>
      </div>
    );
  }
