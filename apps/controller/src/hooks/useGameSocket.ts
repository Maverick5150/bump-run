import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MoveOption,
  PublicGameState,
  RoomStatePayload,
  SeatColor,
  ServerAck,
} from "@bump-run/shared-types";
import { getSocket } from "../lib/socket.js";
import { clearSession, loadSession, saveSession } from "../lib/storage.js";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
export type AppPhase = "needsJoin" | "lobby" | "playing" | "gameOver";

export interface GameSocketState {
  status: ConnectionStatus;
  phase: AppPhase;
  roomCode: string | null;
  playerId: string | null;
  nickname: string;
  joinError: string | null;
  room: RoomStatePayload | null;
  publicState: PublicGameState | null;
  legalMoves: MoveOption[];
  lastCardDrawn: string | null;
  winnerSeat: SeatColor | null;
  join: (roomCode: string, nickname: string) => void;
  selectColor: (seat: SeatColor) => void;
  setReady: (ready: boolean) => void;
  draw: () => void;
  chooseMove: (move: MoveOption) => void;
  leaveToJoinScreen: () => void;
}

function pathRoomCode(): string {
  const match = window.location.pathname.match(/\/join\/([A-Za-z0-9]{4,8})/);
  return match ? match[1]!.toUpperCase() : "";
}

export function useGameSocket(): GameSocketState {
  const socket = getSocket();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [phase, setPhase] = useState<AppPhase>("needsJoin");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomStatePayload | null>(null);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [legalMoves, setLegalMoves] = useState<MoveOption[]>([]);
  const [lastCardDrawn, setLastCardDrawn] = useState<string | null>(null);
  const [winnerSeat, setWinnerSeat] = useState<SeatColor | null>(null);
  const attemptedAutoReconnect = useRef(false);

  useEffect(() => {
    function onConnect() {
      setStatus("connected");
    }
    function onDisconnect() {
      setStatus("disconnected");
    }
    function onRoomState(payload: RoomStatePayload) {
      setRoom(payload);
      // room:state is the single source of truth for which screen to show,
      // including right after a reconnect -- a reload mid-game must land the
      // player back on the game screen, never stuck in the lobby.
      if (payload.room.phase === "lobby") setPhase("lobby");
      else if (payload.room.phase === "playing") setPhase("playing");
      else if (payload.room.phase === "gameOver") setPhase("gameOver");
    }
    function onGameStarted(payload: { state: PublicGameState }) {
      setPublicState(payload.state);
      setLastCardDrawn(null);
      setWinnerSeat(null);
      setPhase("playing");
    }
    function onPublicState(payload: { state: PublicGameState }) {
      setPublicState(payload.state);
    }
    function onPrivateState(payload: { legalMoves: MoveOption[] }) {
      setLegalMoves(payload.legalMoves);
    }
    function onCardDrawn(payload: { card: string }) {
      setLastCardDrawn(payload.card);
    }
    function onMoveResolved(payload: { state: PublicGameState }) {
      setPublicState(payload.state);
      setLegalMoves([]);
    }
    function onWon(payload: { seat: SeatColor }) {
      setWinnerSeat(payload.seat);
      setPhase("gameOver");
    }
    function onError(payload: { code: string; message: string }) {
      if (payload.code === "INVALID_TOKEN" || payload.code === "ROOM_NOT_FOUND") {
        clearSession();
        setPhase("needsJoin");
      }
      setJoinError(payload.message);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onRoomState);
    socket.on("game:started", onGameStarted);
    socket.on("game:publicState", onPublicState);
    socket.on("game:privateState", onPrivateState);
    socket.on("turn:cardDrawn", onCardDrawn);
    socket.on("move:resolved", onMoveResolved);
    socket.on("game:won", onWon);
    socket.on("room:error", onError);

    if (socket.connected) setStatus("connected");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onRoomState);
      socket.off("game:started", onGameStarted);
      socket.off("game:publicState", onPublicState);
      socket.off("game:privateState", onPrivateState);
      socket.off("turn:cardDrawn", onCardDrawn);
      socket.off("move:resolved", onMoveResolved);
      socket.off("game:won", onWon);
      socket.off("room:error", onError);
    };
  }, [socket]);

  // Attempt to restore a previous session once connected.
  useEffect(() => {
    if (status !== "connected" || attemptedAutoReconnect.current) return;
    attemptedAutoReconnect.current = true;
    const stored = loadSession();
    if (!stored) return;
    socket.emit(
      "room:reconnect",
      { roomCode: stored.roomCode, reconnectToken: stored.reconnectToken },
      (res: ServerAck<{ playerId: string }>) => {
        if (res.ok && res.data) {
          setRoomCode(stored.roomCode);
          setPlayerId(res.data.playerId);
          setNickname(stored.nickname);
          // Don't force a phase here -- the server's room:state (and, if a
          // game is already running, game:publicState) arrive right after
          // this ack and drive the correct screen (lobby/playing/gameOver).
        } else {
          clearSession();
        }
      },
    );
  }, [status, socket]);

  const join = useCallback(
    (roomCodeInput: string, nicknameInput: string) => {
      setJoinError(null);
      const code = (roomCodeInput || pathRoomCode()).toUpperCase().trim();
      socket.emit(
        "room:join",
        { roomCode: code, nickname: nicknameInput },
        (res: ServerAck<{ playerId: string; reconnectToken: string }>) => {
          if (res.ok && res.data) {
            setRoomCode(code);
            setPlayerId(res.data.playerId);
            setNickname(nicknameInput);
            saveSession({
              roomCode: code,
              playerId: res.data.playerId,
              reconnectToken: res.data.reconnectToken,
              nickname: nicknameInput,
            });
            setPhase("lobby");
          } else {
            setJoinError(res.error ?? "Could not join that room.");
          }
        },
      );
    },
    [socket],
  );

  const selectColor = useCallback((seat: SeatColor) => socket.emit("player:selectColor", { seat }), [socket]);
  const setReady = useCallback((ready: boolean) => socket.emit("player:ready", { ready }), [socket]);
  const draw = useCallback(() => socket.emit("turn:draw", {}), [socket]);
  const chooseMove = useCallback((move: MoveOption) => socket.emit("turn:chooseMove", { move }), [socket]);
  const leaveToJoinScreen = useCallback(() => {
    clearSession();
    setPhase("needsJoin");
    setRoomCode(null);
    setPlayerId(null);
  }, []);

  return {
    status,
    phase,
    roomCode,
    playerId,
    nickname,
    joinError,
    room,
    publicState,
    legalMoves,
    lastCardDrawn,
    winnerSeat,
    join,
    selectColor,
    setReady,
    draw,
    chooseMove,
    leaveToJoinScreen,
  };
}

export { pathRoomCode };
