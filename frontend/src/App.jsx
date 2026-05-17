import { useState } from "react";
import Lobby from "./components/Lobby";
import GameBoard from "./components/GameBoard";
import Result from "./components/Result";
import { joinSession, waitForBothPlayers } from "./api";
import { fetchHousePublicKey } from "./crypto";

export default function App() {
  const [phase, setPhase] = useState("lobby");
  const [session, setSession] = useState(null);
  const [gameResult, setGameResult] = useState(null);

  async function handleJoin({ player, scheme, privateKeyPem }) {
  const housePublicKey = await fetchHousePublicKey("RSA");
  const sessionData = await joinSession({
    player,
    scheme,
    playerPrivateKey: privateKeyPem,
    housePublicKey,
  });
  setSession({ player, scheme, ...sessionData });
  setPhase("waiting");                                
  await waitForBothPlayers(sessionData.sessionId);    
  setPhase("playing");
}

  function handleGameOver(result) {
    setGameResult(result);
    setPhase("result");
  }

  function handlePlayAgain() {
    setSession(null);
    setGameResult(null);
    setPhase("lobby");
  }

  if (phase === "lobby") return <Lobby onJoin={handleJoin} />;

  if (phase === "playing") return <GameBoard onGameOver={handleGameOver} />;

  if (phase === "result")
    return (
      <Result
        playerName={session?.player === "player1" ? "Player 1" : "Player 2"}
        playerScore={gameResult.playerScore}
        opponentScore={gameResult.opponentScore}
        roundHistory={gameResult.roundHistory}
        sessionKey={gameResult.sessionKey}
        onPlayAgain={handlePlayAgain}
      />
    );

  if (phase === "waiting")
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'IBM Plex Mono', monospace",
      color: "#c9a84c",
      fontSize: "0.9rem",
      letterSpacing: "0.2em",
    }}>
        WAITING FOR SECOND PLAYER…
    </div>
  );
}


