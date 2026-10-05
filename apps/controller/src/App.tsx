import { useState } from "react";
import { useGameSocket } from "./hooks/useGameSocket.js";
import { JoinScreen } from "./screens/JoinScreen.js";
import { LobbyScreen } from "./screens/LobbyScreen.js";
import { GameScreen } from "./screens/GameScreen.js";
import { WinScreen } from "./screens/WinScreen.js";
import { HowToPlayScreen } from "./screens/HowToPlayScreen.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";

export function App() {
  const game = useGameSocket();
  const [overlay, setOverlay] = useState<"none" | "howToPlay" | "settings">("none");

  if (overlay === "howToPlay") return <HowToPlayScreen onClose={() => setOverlay("none")} />;
  if (overlay === "settings") return <SettingsScreen onClose={() => setOverlay("none")} />;

  return (
    <>
      {game.status === "disconnected" && <div className="disconnected-banner">Connection lost. Reconnecting…</div>}

      {game.phase === "needsJoin" && (
        <JoinScreen
          joinError={game.joinError}
          onJoin={game.join}
          onHostRoom={game.hostRoom}
          onShowHowToPlay={() => setOverlay("howToPlay")}
          onShowSettings={() => setOverlay("settings")}
        />
      )}

      {game.phase === "lobby" && (
        <LobbyScreen
          room={game.room}
          playerId={game.playerId}
          isHost={game.isHost}
          onSelectColor={game.selectColor}
          onSetReady={game.setReady}
          onStartGame={game.startGameAsHost}
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

      {game.phase === "gameOver" && (
        <WinScreen
          winnerSeat={game.winnerSeat}
          myNickname={game.nickname}
          isHost={game.isHost}
          onPlayAgain={game.playAgainAsHost}
        />
      )}
    </>
  );
}
