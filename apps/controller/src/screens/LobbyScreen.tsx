import type { RoomStatePayload, SeatColor } from "@bump-run/shared-types";
import { ALL_SEATS, SEAT_INFO } from "../lib/seats.js";

export function LobbyScreen(props: {
  room: RoomStatePayload | null;
  playerId: string | null;
  onSelectColor: (seat: SeatColor) => void;
  onSetReady: (ready: boolean) => void;
}) {
  const { room, playerId } = props;
  const me = room?.players.find((p) => p.playerId === playerId) ?? null;
  const takenSeats = new Set(room?.players.filter((p) => p.playerId !== playerId).map((p) => p.seat) ?? []);

  return (
    <div className="screen">
      <div className="logo" style={{ fontSize: "1.6rem" }}>
        BUMP<span className="accent"> RUN</span>
      </div>
      <div className="room-code">{room?.room.roomCode ?? "----"}</div>

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
      </div>

      <button
        className={me?.ready ? "btn-secondary" : "btn-primary"}
        disabled={!me?.seat}
        onClick={() => props.onSetReady(!me?.ready)}
      >
        {me?.ready ? "Not Ready" : "I'm Ready"}
      </button>
      <div className="status-banner">Waiting for the TV host to start the game…</div>
    </div>
  );
}
