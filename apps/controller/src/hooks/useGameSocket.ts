import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MoveOption,
  PublicGameState,
  RoomStatePayload,
  SeatColor,
  ServerAck,
} from "@bump-run/shared-types";
import { getHostSocket, getSocket, type AppSocket } from "../lib/socket.js";
import { sounds } from "../lib/sound.js";
import { clearSession, loadSession, saveSession } from "../lib/storage.js";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
export type AppPhase = "needsJoin" | "lobby" | "playing" | "gameOver";

export interface BumpEvent {
  seat: SeatColor;
  pawnId: string;
  nonce: number;
}

export interface BoostEvent {
  laneId: string;
  nonce: number;
}

export interface GameSocketState {
  status: ConnectionStatus;
  phase: AppPhase;
  roomCode: string | null;
  playerId: string | null;
  nickname: string;
  joinError: string | null;
  isHost: boolean;
  room: RoomStatePayload | null;
  publicState: PublicGameState | null;
  legalMoves: MoveOption[];
  lastCardDrawn: string | null;
  bumpEvent: BumpEvent | null;
  boostEvent: BoostEvent | null;
  winnerSeat: SeatColor | null;
  join: (roomCode: string, nickname: string) => void;
  hostRoom: (nickname: string) => void;
  startGameAsHost: (botSeats: SeatColor[]) => void;
  playAgainAsHost: () => void;
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

function createRoomAck(socket: AppSocket): Promise<{ roomCode: string; roomId: string; hostToken: string }> {
  return new Promise((resolve, reject) => {
    socket.emit("room:create", {}, (res: ServerAck<{ roomCode: string; roomId: string; hostToken: string }>) => {
      if (res.ok && res.data) resolve(res.data);
      else reject(new Error(res.error ?? "Could not create a room."));
    });
  });
}

function joinRoomAck(
  socket: AppSocket,
  roomCode: string,
  nickname: string,
): Promise<{ playerId: string; reconnectToken: string }> {
  return new Promise((resolve, reject) => {
    socket.emit("room:join", { roomCode, nickname }, (res: ServerAck<{ playerId: string; reconnectToken: string }>) => {
      if (res.ok && res.data) resolve(res.data);
      else reject(new Error(res.error ?? "Could not join that room."));
    });
  });
}

function whenConnected(socket: AppSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve) => socket.once("connect", () => resolve()));
}

export function useGameSocket(): GameSocketState {
  const socket = getSocket();
  const hostSocketRef = useRef<AppSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [phase, setPhase] = useState<AppPhase>("needsJoin");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [room, setRoom] = useState<RoomStatePayload | null>(null);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [legalMoves, setLegalMoves] = useState<MoveOption[]>([]);
  const [lastCardDrawn, setLastCardDrawn] = useState<string | null>(null);
  const [bumpEvent, setBumpEvent] = useState<BumpEvent | null>(null);
  const [boostEvent, setBoostEvent] = useState<BoostEvent | null>(null);
  const [winnerSeat, setWinnerSeat] = useState<SeatColor | null>(null);
  const attemptedAutoReconnect = useRef(false);
  const wasMyTurn = useRef(false);
  const playerIdRef = useRef<string | null>(null);
  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  function checkYourTurn(state: PublicGameState) {
    const current = state.players[state.currentPlayerIndex];
    const isMyTurn = current?.playerId === playerIdRef.current;
    if (isMyTurn && !wasMyTurn.current) sounds.yourTurn();
    wasMyTurn.current = isMyTurn;
  }

  const homeStatus = useRef<Map<string, boolean>>(new Map());
  function checkHomeArrivals(state: PublicGameState) {
    let anyNewlyHome = false;
    for (const player of state.players) {
      for (const pawn of player.pawns) {
        const isHomeNow = pawn.location.zone === "home";
        const wasHome = homeStatus.current.get(pawn.id) ?? false;
        if (isHomeNow && !wasHome) anyNewlyHome = true;
        homeStatus.current.set(pawn.id, isHomeNow);
      }
    }
    if (anyNewlyHome) sounds.home();
  }

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
      wasMyTurn.current = false;
      homeStatus.current.clear();
      checkYourTurn(payload.state);
    }
    function onPublicState(payload: { state: PublicGameState }) {
      setPublicState(payload.state);
    }
    function onPrivateState(payload: { legalMoves: MoveOption[] }) {
      setLegalMoves(payload.legalMoves);
    }
    function onCardDrawn(payload: { card: string }) {
      setLastCardDrawn(payload.card);
      sounds.cardDraw();
    }
    function onBumped(payload: { seat: SeatColor; pawnId: string }) {
      setBumpEvent({ ...payload, nonce: Date.now() + Math.random() });
      sounds.bump();
    }
    function onBoostTriggered(payload: { laneId: string }) {
      setBoostEvent({ ...payload, nonce: Date.now() + Math.random() });
      sounds.boost();
    }
    function onMoveResolved(payload: { state: PublicGameState }) {
      setPublicState(payload.state);
      setLegalMoves([]);
      checkHomeArrivals(payload.state);
      checkYourTurn(payload.state);
    }
    function onWon(payload: { seat: SeatColor }) {
      setWinnerSeat(payload.seat);
      setPhase("gameOver");
      sounds.win();
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
    socket.on("player:bumped", onBumped);
    socket.on("boost:triggered", onBoostTriggered);
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
      socket.off("player:bumped", onBumped);
      socket.off("boost:triggered", onBoostTriggered);
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
            setIsHost(false);
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

  /** Create a room on a second (host-role) connection, then join it on the main connection as a player. */
  const createAndJoinSelf = useCallback(
    async (nicknameInput: string): Promise<{ roomCode: string }> => {
      const host = getHostSocket();
      hostSocketRef.current = host;
      await whenConnected(host);
      const created = await createRoomAck(host);
      const joined = await joinRoomAck(socket, created.roomCode, nicknameInput);
      setRoomCode(created.roomCode);
      setPlayerId(joined.playerId);
      setNickname(nicknameInput);
      setIsHost(true);
      saveSession({
        roomCode: created.roomCode,
        playerId: joined.playerId,
        reconnectToken: joined.reconnectToken,
        nickname: nicknameInput,
      });
      return { roomCode: created.roomCode };
    },
    [socket],
  );

  const hostRoom = useCallback(
    (nicknameInput: string) => {
      setJoinError(null);
      createAndJoinSelf(nicknameInput || "You")
        .then(() => {
          socket.emit("player:selectColor", { seat: "red" });
          socket.emit("player:ready", { ready: true });
          setPhase("lobby");
        })
        .catch((err: Error) => setJoinError(err.message));
    },
    [createAndJoinSelf, socket],
  );

  const startGameAsHost = useCallback((botSeats: SeatColor[]) => {
    hostSocketRef.current?.emit("game:start", { botSeats });
  }, []);

  const playAgainAsHost = useCallback(() => {
    hostSocketRef.current?.emit("game:playAgain", {});
  }, []);

  const selectColor = useCallback((seat: SeatColor) => socket.emit("player:selectColor", { seat }), [socket]);
  const setReady = useCallback((ready: boolean) => socket.emit("player:ready", { ready }), [socket]);
  const draw = useCallback(() => socket.emit("turn:draw", {}), [socket]);
  const chooseMove = useCallback((move: MoveOption) => socket.emit("turn:chooseMove", { move }), [socket]);
  const leaveToJoinScreen = useCallback(() => {
    clearSession();
    hostSocketRef.current?.disconnect();
    hostSocketRef.current = null;
    setIsHost(false);
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
    isHost,
    room,
    publicState,
    legalMoves,
    lastCardDrawn,
    bumpEvent,
    boostEvent,
    winnerSeat,
    join,
    hostRoom,
    startGameAsHost,
    playAgainAsHost,
    selectColor,
    setReady,
    draw,
    chooseMove,
    leaveToJoinScreen,
  };
}

export { pathRoomCode };
