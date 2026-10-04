import { useGameSocket } from "./hooks/useGameSocket.js";
import { JoinScreen } from "./screens/JoinScreen.js";
import { LobbyScreen } from "./screens/LobbyScreen.js";
import { GameScreen } from "./screens/GameScreen.js";
import { WinScreen } from "./screens/WinScreen.js";

export function App() {
  const game = useGameSocket();

  return (
    <>
      {game.status === "disconnected" && <div className="disconnected-banner">Connection lost. Reconnecting…</div>}

      {game.phase === "needsJoin" && <JoinScreen joinError={game.joinError} onJoin={game.join} />}

      {game.phase === "lobby" && (
        <LobbyScreen
          room={game.room}
          playerId={game.playerId}
          onSelectColor={game.selectColor}
          onSetReady={game.setReady}
        />
      )}

      {game.phase === "playing" && game.publicState && (
        <GameScreen
          publicState={game.publicState}
          playerId={game.playerId}
          legalMoves={game.legalMoves}
          lastCardDrawn={game.lastCardDrawn}
          onDraw={game.draw}
          onChooseMove={game.chooseMove}
        />
      )}

      {game.phase === "gameOver" && <WinScreen winnerSeat={game.winnerSeat} myNickname={game.nickname} />}
    </>
  );
}
