import { useEffect, useRef, useState } from "react";
import type { RoomStatePayload, SeatColor } from "@bump-run/shared-types";
import { ALL_SEATS, SEAT_INFO } from "../lib/seats.js";

export function LobbyScreen(props: {
  room: RoomStatePayload | null;
  playerId: string | null;
  isHost: boolean;
  onSelectColor: (seat: SeatColor) => void;
  onSetReady: (ready: boolean) => void;
  onStartGame: (botSeats: SeatColor[]) => void;
}) {
  const { room, playerId, isHost } = props;
  const me = room?.players.find((p) => p.playerId === playerId) ?? null;
  const takenSeats = new Set(room?.players.filter((p) => p.playerId !== playerId).map((p) => p.seat) ?? []);
  const openSeats = ALL_SEATS.filter((s) => s !== me?.seat && !takenSeats.has(s));

  // Defaults to filling every open seat with AI (so solo play needs zero
  // extra taps -- just press Start) until the host manually adjusts the
  // stepper, after which it only ever clamps down if seats fill up.
  const [aiCount, setAiCount] = useState(openSeats.length);
  const aiTouched = useRef(false);
  useEffect(() => {
    if (aiTouched.current) {
      setAiCount((c) => Math.min(c, openSeats.length));
    } else {
      setAiCount(openSeats.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only reacts to seat-count changes
  }, [openSeats.length]);

  function adjustAiCount(delta: number) {
    aiTouched.current = true;
    setAiCount((c) => Math.max(0, Math.min(openSeats.length, c + delta)));
  }

  const botSeats = openSeats.slice(0, aiCount);
  const readyCount = room?.players.filter((p) => p.ready && p.seat).length ?? 0;
  const canStart = readyCount >= 1 && readyCount + botSeats.length >= 2;

  return (
    <div className="screen">
      <div className="logo" style={{ fontSize: "1.6rem" }}>
        BUMP<span className="accent"> RUN</span>
      </div>
      <div className="room-code">{room?.room.roomCode ?? "----"}</div>
      {isHost && <div className="card-blurb">Share this code with friends, or just add AI below.</div>}

      <div className="seat-grid">
        {ALL_SEATS.map((seat) => {
          const info = SEAT_INFO[seat];
          const taken = takenSeats.has(seat);
          const selected = me?.seat === seat;
          return (
            <button
              key={seat}
              className={`seat-tile${selected ? " selected" : ""}${taken ? " taken" : ""}`}
              style={{ background: info.hex }}
              disabled={taken}
              onClick={() => props.onSelectColor(seat)}
            >
              <span className="seat-glyph">{info.glyph}</span>
              {info.label}
            </button>
          );
        })}
      </div>

      <div className="player-list">
        {(room?.players.length ?? 0) === 0 && <div className="status-banner">Waiting for players to join…</div>}
        {room?.players.map((p) => {
          const info = p.seat ? SEAT_INFO[p.seat] : null;
          return (
            <div className="player-row" key={p.playerId}>
              <span className="player-dot" style={{ background: info?.hex ?? "#555" }} />
              <span className="player-name">
                {p.nickname}
                {!p.connected ? " (reconnecting…)" : ""}
              </span>
              {p.ready ? <span className="player-ready">READY</span> : <span className="player-waiting">Waiting</span>}
            </div>
          );
        })}
        {botSeats.map((seat) => {
          const info = SEAT_INFO[seat];
          return (
            <div className="player-row" key={seat}>
              <span className="player-dot" style={{ background: info.hex }} />
              <span className="player-name">AI {info.label}</span>
              <span className="player-ready">🤖</span>
            </div>
          );
        })}
      </div>

      <button
        className={me?.ready ? "btn-secondary" : "btn-primary"}
        disabled={!me?.seat}
        onClick={() => props.onSetReady(!me?.ready)}
      >
        {me?.ready ? "Not Ready" : "I'm Ready"}
      </button>

      {isHost ? (
        <>
          {openSeats.length > 0 && (
            <div className="ai-stepper">
              <span>AI players</span>
              <button className="stepper-btn" disabled={aiCount <= 0} onClick={() => adjustAiCount(-1)}>
                −
              </button>
              <span className="stepper-count">{aiCount}</span>
              <button className="stepper-btn" disabled={aiCount >= openSeats.length} onClick={() => adjustAiCount(1)}>
                +
              </button>
            </div>
          )}
          <button className="btn-primary" disabled={!canStart} onClick={() => props.onStartGame(botSeats)}>
            {canStart ? "Start Game" : "Ready up or add AI"}
          </button>
        </>
      ) : (
        <div className="status-banner">Waiting for the host to start the game…</div>
      )}
    </div>
  );
}
