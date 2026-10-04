import { useState } from "react";
import { pathRoomCode } from "../hooks/useGameSocket.js";

export function JoinScreen(props: { joinError: string | null; onJoin: (roomCode: string, nickname: string) => void }) {
  const [roomCode, setRoomCode] = useState(pathRoomCode());
  const [nickname, setNickname] = useState("");

  const canSubmit = roomCode.trim().length >= 4 && nickname.trim().length >= 1;

  return (
    <div className="screen">
      <div className="logo">
        BUMP<span className="accent"> RUN</span>
      </div>
      <div className="tagline">Race. Bump. Win.</div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        <label>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Nickname</div>
          <input
            type="text"
            value={nickname}
            maxLength={16}
            placeholder="Your name"
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>
        {props.joinError && <div style={{ color: "var(--danger)", fontWeight: 600 }}>{props.joinError}</div>}
        <button className="btn-primary" disabled={!canSubmit} onClick={() => props.onJoin(roomCode, nickname)}>
          Join Game
        </button>
      </div>
    </div>
  );
}
