import { useState } from "react";
import Lobby     from "./components/Lobby";
import GameBoard from "./components/GameBoard";
import Result    from "./components/Result";
import { joinSession } from "./api";

export default function App() {
  const [phase, setPhase]         = useState("lobby");
  const [session, setSession]     = useState(null);
  const [gameResult, setGameResult] = useState(null);

  async function handleJoin({ player, scheme }) {
    const sessionData = await joinSession({ player, scheme });
    setSession({ player, scheme, ...sessionData });
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

  if (phase === "lobby")
    return <Lobby onJoin={handleJoin} />;

  if (phase === "playing")
    return <GameBoard onGameOver={handleGameOver} />;

  if (phase === "result")
    return (
      <Result
        playerName    = {session?.player === "player1" ? "Player 1" : "Player 2"}
        playerScore   = {gameResult.playerScore}
        opponentScore = {gameResult.opponentScore}
        roundHistory  = {gameResult.roundHistory}
        sessionKey    = {gameResult.sessionKey}
        onPlayAgain   = {handlePlayAgain}
      />
    );
}
