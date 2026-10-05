import { useState } from "react";
import { pathRoomCode } from "../hooks/useGameSocket.js";

export function JoinScreen(props: {
  joinError: string | null;
  onJoin: (roomCode: string, nickname: string) => void;
  onHostRoom: (nickname: string) => void;
  onShowHowToPlay: () => void;
  onShowSettings: () => void;
}) {
  const [roomCode, setRoomCode] = useState(pathRoomCode());
  const [nickname, setNickname] = useState("");

  const effectiveName = nickname.trim() || "You";
  const canJoin = roomCode.trim().length >= 4;

  return (
    <div className="screen screen-title">
      <div className="corner-controls">
        <button className="icon-btn" aria-label="How to play" onClick={props.onShowHowToPlay}>
          ?
        </button>
        <button className="icon-btn" aria-label="Settings" onClick={props.onShowSettings}>
          ⚙
        </button>
      </div>
      <div className="logo" style={{ marginTop: 28 }}>
        BUMP<span className="accent"> RUN</span>
      </div>
      <div className="tagline">Race. Bump. Win.</div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Your name</div>
          <input
            type="text"
            value={nickname}
            maxLength={16}
            placeholder="You"
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>

        {props.joinError && <div style={{ color: "var(--danger)", fontWeight: 600 }}>{props.joinError}</div>}

        <button className="btn-primary" onClick={() => props.onHostRoom(effectiveName)}>
          Start a Game
        </button>
        <div className="card-blurb" style={{ marginTop: -6 }}>
          Choose your color and AI opponents next -- play solo, with friends, or both.
        </div>

        <div className="divider">or join a room someone else is hosting</div>

        <label>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Room code</div>
          <input
            type="text"
            value={roomCode}
            maxLength={8}
            autoCapitalize="characters"
            placeholder="ABCD"
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          />
        </label>
        <button className="btn-secondary" disabled={!canJoin} onClick={() => props.onJoin(roomCode, effectiveName)}>
          Join Game
        </button>
      </div>
    </div>
  );
}
