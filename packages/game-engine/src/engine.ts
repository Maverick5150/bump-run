import type {
  CardType,
  GameEvent,
  GameState,
  MoveOption,
  PawnState,
  PlayerState,
  PublicGameState,
  SeatColor,
} from "@bump-run/shared-types";
import { BOOST_LANES, ENTRY_OFFSET, GAME_RULES } from "./config.js";
import { entryGlobalPos, HOME_LOCAL, locationToLocal, localToLocation, sameLocation } from "./board.js";
import { drawCard, shuffledDeck } from "./deck.js";
import { seedFromString } from "./rng.js";

const { MAIN_TRACK_LENGTH, SAFE_ZONE_LENGTH, PAWNS_PER_PLAYER } = GAME_RULES;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface NewPlayerSpec {
  playerId: string;
  seat: SeatColor;
  nickname: string;
}

export function createGame(playerSpecs: NewPlayerSpec[], seed?: string | number): GameState {
  if (playerSpecs.length < GAME_RULES.MIN_PLAYERS || playerSpecs.length > GAME_RULES.MAX_PLAYERS) {
    throw new Error(
      `createGame requires between ${GAME_RULES.MIN_PLAYERS} and ${GAME_RULES.MAX_PLAYERS} players`,
    );
  }

  const rngSeed =
    seed === undefined ? Date.now() ^ 0x9e3779b9 : typeof seed === "string" ? seedFromString(seed) : seed;

  const { deck, nextState } = shuffledDeck(rngSeed);

  const players: PlayerState[] = playerSpecs.map((spec) => ({
    playerId: spec.playerId,
    seat: spec.seat,
    nickname: spec.nickname,
    ready: true,
    connected: true,
    isHostCandidate: false,
    pawns: Array.from({ length: PAWNS_PER_PLAYER }, (_, i) => ({
      id: `${spec.seat}-${i}`,
      ownerSeat: spec.seat,
      location: { zone: "start" as const },
    })),
    stats: { pawnsBumpedByMe: 0, timesBumped: 0, boostLanesTriggered: 0, cardsDrawn: 0 },
  }));

  return {
    revision: 0,
    phase: "playing",
    players,
    currentPlayerIndex: 0,
    deck,
    discard: [],
    activeCard: null,
    rngState: nextState,
    winnerSeat: null,
    turnCount: 0,
    lastEvents: [],
    startedAt: Date.now(),
    finishedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function clone(state: GameState): GameState {
  return structuredClone(state);
}

export function getCurrentPlayer(state: GameState): PlayerState {
  const player = state.players[state.currentPlayerIndex];
  if (!player) throw new Error("currentPlayerIndex out of range");
  return player;
}

export function findPawnOwner(state: GameState, pawnId: string): { player: PlayerState; pawn: PawnState } | null {
  for (const player of state.players) {
    const pawn = player.pawns.find((p) => p.id === pawnId);
    if (pawn) return { player, pawn };
  }
  return null;
}

/** Find whichever pawn (any seat) currently sits on a given global main-track square. */
function pawnAtGlobalPos(state: GameState, pos: number): { player: PlayerState; pawn: PawnState } | null {
  for (const player of state.players) {
    for (const pawn of player.pawns) {
      if (pawn.location.zone === "main" && pawn.location.pos === pos) {
        return { player, pawn };
      }
    }
  }
  return null;
}

function positionsBetweenExclusive(start: number, end: number, trackLength: number): number[] {
  const out: number[] = [];
  let p = (start + 1) % trackLength;
  while (p !== end) {
    out.push(p);
    p = (p + 1) % trackLength;
  }
  return out;
}

function sendPawnToStart(state: GameState, pawn: PawnState, owner: PlayerState): void {
  pawn.location = { zone: "start" };
  owner.stats.timesBumped += 1;
}

function pushEvent(state: GameState, event: GameEvent): void {
  state.lastEvents.push(event);
}

/**
 * Checks landing on `pos` (main track) for a pawn belonging to `seat`,
 * applying bump-on-landing. Returns false if blocked by the mover's OWN pawn
 * (illegal), true otherwise. Mutates `state` in place (caller passes a clone).
 */
function resolveLandingOnMain(state: GameState, seat: SeatColor, pos: number, mover: PlayerState): boolean {
  const occupant = pawnAtGlobalPos(state, pos);
  if (!occupant) return true;
  if (occupant.pawn.ownerSeat === seat) {
    return false; // blocked by own pawn
  }
  // bump opponent
  sendPawnToStart(state, occupant.pawn, occupant.player);
  mover.stats.pawnsBumpedByMe += 1;
  pushEvent(state, {
    type: "bumped",
    payload: { seat: occupant.pawn.ownerSeat, pawnId: occupant.pawn.id },
  });
  return true;
}

/**
 * Returns false if the boost would land the pawn on a square its own other
 * pawn already occupies (illegal, same as any other own-pawn block).
 */
function tryApplyBoost(state: GameState, pawn: PawnState, owner: PlayerState): boolean {
  if (pawn.location.zone !== "main") return true;
  const pos = pawn.location.pos;
  const lane = BOOST_LANES.find((l) => l.startPos === pos && l.ownerColor !== pawn.ownerSeat);
  if (!lane) return true;

  const endOccupant = pawnAtGlobalPos(state, lane.endPos);
  if (endOccupant && endOccupant.pawn.ownerSeat === pawn.ownerSeat) {
    return false; // blocked by own pawn at the far end of the lane
  }

  const between = positionsBetweenExclusive(lane.startPos, lane.endPos, MAIN_TRACK_LENGTH);
  for (const p of between) {
    const occ = pawnAtGlobalPos(state, p);
    if (occ) sendPawnToStart(state, occ.pawn, occ.player);
  }
  if (endOccupant) {
    sendPawnToStart(state, endOccupant.pawn, endOccupant.player);
    owner.stats.pawnsBumpedByMe += 1;
    pushEvent(state, { type: "bumped", payload: { seat: endOccupant.pawn.ownerSeat, pawnId: endOccupant.pawn.id } });
  }
  pawn.location = { zone: "main", pos: lane.endPos };
  owner.stats.boostLanesTriggered += 1;
  pushEvent(state, { type: "boostTriggered", payload: { laneId: lane.id, pawnId: pawn.id } });
  return true;
}

// ---------------------------------------------------------------------------
// Movement primitives (used both for direct validation and split simulation)
// ---------------------------------------------------------------------------

interface MoveSim {
  state: GameState;
}

/** Attempt a forward move; returns a new state or null if illegal. Does not touch turn/deck. */
function simulateForward(state: GameState, pawnId: string, distance: number): MoveSim | null {
  if (distance <= 0) return null;
  const found = findPawnOwner(state, pawnId);
  if (!found) return null;
  const { player, pawn } = found;
  if (pawn.location.zone === "start" || pawn.location.zone === "home") return null;

  const local = locationToLocal(pawn.location, pawn.ownerSeat, ENTRY_OFFSET);
  if (local === null) return null;
  const newLocal = local + distance;
  if (newLocal > HOME_LOCAL) return null; // overshoot Home is illegal

  const nextState = clone(state);
  const nf = findPawnOwner(nextState, pawnId)!;
  const newLocation = localToLocation(newLocal, pawn.ownerSeat, ENTRY_OFFSET);

  if (newLocation.zone === "home") {
    // Home has no per-square stacking limit -- every pawn that finishes just "is home".
    nf.pawn.location = newLocation;
    pushEvent(nextState, { type: "pawnHome", payload: { seat: pawn.ownerSeat, pawnId } });
    return { state: nextState };
  }

  if (newLocation.zone === "safe") {
    const blockedByOwn = nf.player.pawns.some(
      (p) => p.id !== pawnId && sameLocation(p.location, newLocation),
    );
    if (blockedByOwn) return null;
    nf.pawn.location = newLocation;
    return { state: nextState };
  }

  // main track landing
  if (newLocation.zone !== "main") {
    throw new Error("localToLocation returned an impossible zone for a forward move");
  }
  const ok = resolveLandingOnMain(nextState, pawn.ownerSeat, newLocation.pos, nf.player);
  if (!ok) return null;
  nf.pawn.location = newLocation;
  if (!tryApplyBoost(nextState, nf.pawn, nf.player)) return null;
  return { state: nextState };
}

/** Attempt a backward move. Pawns in the safe zone may back out onto the main track. */
function simulateBackward(state: GameState, pawnId: string, distance: number): MoveSim | null {
  if (distance <= 0) return null;
  const found = findPawnOwner(state, pawnId);
  if (!found) return null;
  const { pawn } = found;
  if (pawn.location.zone === "start" || pawn.location.zone === "home") return null;

  const nextState = clone(state);
  const nf = findPawnOwner(nextState, pawnId)!;

  let globalPos: number;

  if (nf.pawn.location.zone === "safe") {
    const newIndex = nf.pawn.location.index - distance;
    if (newIndex >= 1) {
      const newLocation = { zone: "safe" as const, index: newIndex };
      const blockedByOwn = nf.player.pawns.some((p) => p.id !== pawnId && sameLocation(p.location, newLocation));
      if (blockedByOwn) return null;
      nf.pawn.location = newLocation;
      return { state: nextState };
    }
    // Exits the safe zone back onto the main track at the safe-zone entrance
    // square, then continues backward around the shared ring for whatever
    // distance is still owed (newIndex is <= 0, so -newIndex is the extra steps).
    const entranceLoc = localToLocation(GAME_RULES.STEPS_ENTRY_TO_SAFE_ENTRANCE, pawn.ownerSeat, ENTRY_OFFSET);
    const entrancePos = entranceLoc.zone === "main" ? entranceLoc.pos : 0;
    const stepsOwedBeyondEntrance = -newIndex;
    globalPos =
      ((entrancePos - stepsOwedBeyondEntrance) % MAIN_TRACK_LENGTH + MAIN_TRACK_LENGTH) % MAIN_TRACK_LENGTH;
  } else if (nf.pawn.location.zone === "main") {
    globalPos = ((nf.pawn.location.pos - distance) % MAIN_TRACK_LENGTH + MAIN_TRACK_LENGTH) % MAIN_TRACK_LENGTH;
  } else {
    return null;
  }

  const ok = resolveLandingOnMain(nextState, pawn.ownerSeat, globalPos, nf.player);
  if (!ok) return null;
  nf.pawn.location = { zone: "main", pos: globalPos };
  if (!tryApplyBoost(nextState, nf.pawn, nf.player)) return null;
  return { state: nextState };
}

function canEnterFromStart(state: GameState, pawnId: string): MoveSim | null {
  const found = findPawnOwner(state, pawnId);
  if (!found) return null;
  const { pawn } = found;
  if (pawn.location.zone !== "start") return null;

  const entry = entryGlobalPos(pawn.ownerSeat, ENTRY_OFFSET);
  const nextState = clone(state);
  const nf = findPawnOwner(nextState, pawnId)!;
  const ok = resolveLandingOnMain(nextState, pawn.ownerSeat, entry, nf.player);
  if (!ok) return null;
  nf.pawn.location = { zone: "main", pos: entry };
  if (!tryApplyBoost(nextState, nf.pawn, nf.player)) return null;
  return { state: nextState };
}

function isEligibleForSwapOrBumpTarget(pawn: PawnState): boolean {
  return pawn.location.zone === "main";
}

function trySwap(state: GameState, ownPawnId: string, opponentPawnId: string): MoveSim | null {
  const own = findPawnOwner(state, ownPawnId);
  const opp = findPawnOwner(state, opponentPawnId);
  if (!own || !opp) return null;
  if (own.pawn.ownerSeat === opp.pawn.ownerSeat) return null;
  if (!isEligibleForSwapOrBumpTarget(own.pawn) || !isEligibleForSwapOrBumpTarget(opp.pawn)) return null;

  const nextState = clone(state);
  const nOwn = findPawnOwner(nextState, ownPawnId)!;
  const nOpp = findPawnOwner(nextState, opponentPawnId)!;
  const ownLoc = nOwn.pawn.location;
  nOwn.pawn.location = nOpp.pawn.location;
  nOpp.pawn.location = ownLoc;
  pushEvent(nextState, {
    type: "swapped",
    payload: { pawnA: ownPawnId, pawnB: opponentPawnId },
  });
  return { state: nextState };
}

function tryBumpCard(state: GameState, ownPawnId: string, opponentPawnId: string): MoveSim | null {
  const own = findPawnOwner(state, ownPawnId);
  const opp = findPawnOwner(state, opponentPawnId);
  if (!own || !opp) return null;
  if (own.pawn.ownerSeat === opp.pawn.ownerSeat) return null;
  if (own.pawn.location.zone !== "start") return null;
  if (!isEligibleForSwapOrBumpTarget(opp.pawn) || opp.pawn.location.zone !== "main") return null;

  const targetPos = opp.pawn.location.pos;
  const nextState = clone(state);
  const nOwn = findPawnOwner(nextState, ownPawnId)!;
  const nOpp = findPawnOwner(nextState, opponentPawnId)!;
  sendPawnToStart(nextState, nOpp.pawn, nOpp.player);
  nOwn.player.stats.pawnsBumpedByMe += 1;
  nOwn.pawn.location = { zone: "main", pos: targetPos };
  pushEvent(nextState, { type: "bumped", payload: { seat: opp.pawn.ownerSeat, pawnId: opponentPawnId } });
  if (!tryApplyBoost(nextState, nOwn.pawn, nOwn.player)) return null;
  return { state: nextState };
}

// ---------------------------------------------------------------------------
// Legal move enumeration
// ---------------------------------------------------------------------------

function ownMovablePawns(player: PlayerState): PawnState[] {
  return player.pawns.filter((p) => p.location.zone !== "home");
}

function hasAnyOpponentOnMain(state: GameState, seat: SeatColor): PawnState[] {
  const out: PawnState[] = [];
  for (const player of state.players) {
    if (player.seat === seat) continue;
    for (const pawn of player.pawns) {
      if (pawn.location.zone === "main") out.push(pawn);
    }
  }
  return out;
}

export function getLegalMoves(state: GameState): MoveOption[] {
  const card = state.activeCard;
  if (!card) return [];
  const player = getCurrentPlayer(state);
  const options: MoveOption[] = [];

  const addForwardOptionsForAllPawns = (distance: number) => {
    for (const pawn of ownMovablePawns(player)) {
      if (pawn.location.zone === "start") continue;
      if (simulateForward(state, pawn.id, distance)) {
        options.push({ kind: "forward", pawnId: pawn.id, distance });
      }
    }
  };

  const addEnterFromStartOptions = () => {
    for (const pawn of player.pawns) {
      if (pawn.location.zone === "start" && canEnterFromStart(state, pawn.id)) {
        options.push({ kind: "enterFromStart", pawnId: pawn.id });
      }
    }
  };

  switch (card) {
    case "CARD_1": {
      addForwardOptionsForAllPawns(1);
      addEnterFromStartOptions();
      break;
    }
    case "CARD_2": {
      addForwardOptionsForAllPawns(2);
      addEnterFromStartOptions();
      break;
    }
    case "CARD_3": {
      addForwardOptionsForAllPawns(3);
      break;
    }
    case "CARD_4": {
      for (const pawn of ownMovablePawns(player)) {
        if (pawn.location.zone === "start") continue;
        if (simulateBackward(state, pawn.id, 4)) {
          options.push({ kind: "backward", pawnId: pawn.id, distance: 4 });
        }
      }
      break;
    }
    case "CARD_5": {
      addForwardOptionsForAllPawns(5);
      break;
    }
    case "CARD_7": {
      addForwardOptionsForAllPawns(7);
      // every legal split: first leg 1..6, second leg = 7-first, distinct pawns
      const movable = ownMovablePawns(player).filter((p) => p.location.zone !== "start");
      for (const p1 of movable) {
        for (let d1 = 1; d1 <= 6; d1++) {
          const d2 = 7 - d1;
          const firstSim = simulateForward(state, p1.id, d1);
          if (!firstSim) continue;
          for (const p2 of movable) {
            if (p2.id === p1.id) continue;
            const secondSim = simulateForward(firstSim.state, p2.id, d2);
            if (secondSim) {
              options.push({
                kind: "split",
                firstPawnId: p1.id,
                firstDistance: d1,
                secondPawnId: p2.id,
                secondDistance: d2,
              });
            }
          }
        }
      }
      break;
    }
    case "CARD_8": {
      addForwardOptionsForAllPawns(8);
      break;
    }
    case "CARD_10": {
      addForwardOptionsForAllPawns(10);
      for (const pawn of ownMovablePawns(player)) {
        if (pawn.location.zone === "start") continue;
        if (simulateBackward(state, pawn.id, 1)) {
          options.push({ kind: "backward", pawnId: pawn.id, distance: 1 });
        }
      }
      break;
    }
    case "CARD_11": {
      addForwardOptionsForAllPawns(11);
      for (const ownPawn of player.pawns) {
        if (!isEligibleForSwapOrBumpTarget(ownPawn)) continue;
        for (const oppPawn of hasAnyOpponentOnMain(state, player.seat)) {
          if (trySwap(state, ownPawn.id, oppPawn.id)) {
            options.push({ kind: "swap", ownPawnId: ownPawn.id, opponentPawnId: oppPawn.id });
          }
        }
      }
      break;
    }
    case "CARD_12": {
      addForwardOptionsForAllPawns(12);
      break;
    }
    case "BUMP": {
      const startPawns = player.pawns.filter((p) => p.location.zone === "start");
      for (const ownPawn of startPawns) {
        for (const oppPawn of hasAnyOpponentOnMain(state, player.seat)) {
          if (tryBumpCard(state, ownPawn.id, oppPawn.id)) {
            options.push({ kind: "bump", ownPawnId: ownPawn.id, opponentPawnId: oppPawn.id });
          }
        }
      }
      break;
    }
  }

  if (options.length === 0) {
    options.push({ kind: "pass" });
  }

  return options;
}

// ---------------------------------------------------------------------------
// Validation + application
// ---------------------------------------------------------------------------

function moveOptionsEqual(a: MoveOption, b: MoveOption): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function validateMove(state: GameState, move: MoveOption): { valid: boolean; reason?: string } {
  if (!state.activeCard && move.kind !== "pass") {
    return { valid: false, reason: "No card has been drawn yet" };
  }
  const legal = getLegalMoves(state);
  const found = legal.some((option) => moveOptionsEqual(option, move));
  if (!found) return { valid: false, reason: "Move is not in the current legal move set" };
  return { valid: true };
}

export interface ApplyMoveResult {
  state: GameState;
  events: GameEvent[];
}

export function applyMove(state: GameState, move: MoveOption): ApplyMoveResult {
  const validation = validateMove(state, move);
  if (!validation.valid) {
    throw new Error(`Illegal move: ${validation.reason}`);
  }

  let working = clone(state);
  working.lastEvents = [];
  const player = getCurrentPlayer(working);
  let grantsExtraTurn = false;

  switch (move.kind) {
    case "pass": {
      pushEvent(working, { type: "noLegalMoves", payload: { seat: player.seat } });
      break;
    }
    case "enterFromStart": {
      const result = canEnterFromStart(working, move.pawnId);
      if (!result) throw new Error("enterFromStart became illegal during apply");
      working = mergeEvents(working, result.state);
      break;
    }
    case "forward": {
      const result = simulateForward(working, move.pawnId, move.distance);
      if (!result) throw new Error("forward move became illegal during apply");
      working = mergeEvents(working, result.state);
      break;
    }
    case "backward": {
      const result = simulateBackward(working, move.pawnId, move.distance);
      if (!result) throw new Error("backward move became illegal during apply");
      working = mergeEvents(working, result.state);
      break;
    }
    case "split": {
      const firstResult = simulateForward(working, move.firstPawnId, move.firstDistance);
      if (!firstResult) throw new Error("split first leg became illegal during apply");
      const secondResult = simulateForward(firstResult.state, move.secondPawnId, move.secondDistance);
      if (!secondResult) throw new Error("split second leg became illegal during apply");
      working = mergeEvents(working, secondResult.state, firstResult.state.lastEvents);
      break;
    }
    case "swap": {
      const result = trySwap(working, move.ownPawnId, move.opponentPawnId);
      if (!result) throw new Error("swap became illegal during apply");
      working = mergeEvents(working, result.state);
      break;
    }
    case "bump": {
      const result = tryBumpCard(working, move.ownPawnId, move.opponentPawnId);
      if (!result) throw new Error("bump became illegal during apply");
      working = mergeEvents(working, result.state);
      break;
    }
  }

  if (working.activeCard === "CARD_2" && move.kind !== "pass" && GAME_RULES.CARD_2_GRANTS_EXTRA_TURN) {
    grantsExtraTurn = true;
    pushEvent(working, { type: "extraTurn", payload: { seat: player.seat } });
  }

  // discard the resolved card
  if (working.activeCard) {
    working.discard.push(working.activeCard);
  }
  working.activeCard = null;
  working.turnCount += 1;

  const winner = hasWinner(working);
  if (winner) {
    working.winnerSeat = winner;
    working.phase = "gameOver";
    working.finishedAt = Date.now();
    pushEvent(working, { type: "gameWon", payload: { seat: winner } });
  } else if (!grantsExtraTurn) {
    advanceTurnInPlace(working);
  }

  working.revision += 1;
  return { state: working, events: working.lastEvents };
}

function mergeEvents(base: GameState, result: GameState, extraEvents: GameEvent[] = []): GameState {
  result.lastEvents = [...base.lastEvents, ...extraEvents, ...result.lastEvents];
  return result;
}

function advanceTurnInPlace(state: GameState): void {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
}

export function advanceTurn(state: GameState): GameState {
  const next = clone(state);
  advanceTurnInPlace(next);
  next.revision += 1;
  return next;
}

export function applyDraw(state: GameState): GameState {
  if (state.activeCard) {
    throw new Error("A card is already active; resolve it before drawing again");
  }
  const next = clone(state);
  next.lastEvents = [];
  const result = drawCard(next.deck, next.discard, next.rngState);
  next.deck = result.deck;
  next.discard = result.discard;
  next.rngState = result.nextRngState;
  next.activeCard = result.card;
  const player = getCurrentPlayer(next);
  player.stats.cardsDrawn += 1;
  pushEvent(next, { type: "cardDrawn", payload: { seat: player.seat, card: result.card } });
  next.revision += 1;
  return next;
}

export function hasWinner(state: GameState): SeatColor | null {
  for (const player of state.players) {
    if (player.pawns.every((p) => p.location.zone === "home")) return player.seat;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serializePublicState(state: GameState): PublicGameState {
  const { deck, rngState, ...rest } = state;
  return { ...rest, deckCount: deck.length };
}

export function serializePlayerLegalMoves(state: GameState, playerId: string): MoveOption[] {
  const player = getCurrentPlayer(state);
  if (player.playerId !== playerId) return [];
  return getLegalMoves(state);
}

