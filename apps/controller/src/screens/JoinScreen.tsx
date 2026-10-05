import { useState } from "react";
import { pathRoomCode } from "../hooks/useGameSocket.js";

export function JoinScreen(props: {
  joinError: string | null;
  onJoin: (roomCode: string, nickname: string) => void;
  onStartSolo: (nickname: string, botCount: number) => void;
  onHostRoom: (nickname: string) => void;
}) {
  const [roomCode, setRoomCode] = useState(pathRoomCode());
  const [nickname, setNickname] = useState("");

  const effectiveName = nickname.trim() || "You";
  const canJoin = roomCode.trim().length >= 4;

  return (
    <div className="screen">
      <div className="logo">
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

        <button className="btn-primary" onClick={() => props.onStartSolo(effectiveName, 3)}>
          Play solo vs AI
        </button>
        <button className="btn-secondary" onClick={() => props.onHostRoom(effectiveName)}>
          Host a room (play with friends, no TV)
        </button>

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
