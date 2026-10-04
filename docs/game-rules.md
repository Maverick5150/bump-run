# BUMP RUN -- Game Rules

This is the authoritative description of the ruleset implemented in
`packages/game-engine`. If this document and the code ever disagree, the code
(and its tests) wins -- please file that as a bug.

## Setup

- 2-4 players, each assigned one color seat: red, blue, green, or yellow.
- Each player has 4 pawns, all starting in their **Start** area.
- The shared **main track** has 52 spaces, logically numbered `main-00` .. `main-51`.
  Each seat has an **entry** square evenly spaced around it (red=0, blue=13,
  green=26, yellow=39).
- Each seat has a 5-space **protected safety lane** (`<seat>-safe-01` ..
  `-05`) leading to that seat's **Home**. Only that seat's own pawns may ever
  occupy it.

## Turn flow

1. The current player presses **Draw**. The server draws the next card (shuffled,
   seeded for tests, reshuffling the discard pile when the deck runs out).
2. The server computes every legal action for that card and sends it to that
   player's phone only.
3. The player picks one. The server re-validates and applies it.
4. Unless the card grants an extra turn (card 2) or the game just ended, play
   advances to the next seat in order.

If a card yields zero legal moves, the only option is **Pass**, which the server
offers automatically and advances the turn once acknowledged.

## The deck

Counts are centralized in `DECK_COMPOSITION` (`packages/game-engine/src/config.ts`)
and easy to rebalance:

| Card | Default count | Effect |
|---|---|---|
| 1 | 5 | Move 1, or leave Start |
| 2 | 4 | Move 2, or leave Start. **Grants another turn.** |
| 3 | 4 | Move 3 |
| 4 | 4 | Move 4 **backward** |
| 5 | 4 | Move 5 |
| 7 | 4 | Move 7, or split it across two different pawns |
| 8 | 4 | Move 8 |
| 10 | 4 | Move 10, or move 1 backward |
| 11 | 4 | Move 11, or swap with an eligible opponent pawn |
| 12 | 4 | Move 12 |
| BUMP! | 3 | Launch a pawn from Start directly onto an eligible opponent |

## Leaving Start

A pawn may leave Start only on a 1 or 2, moving to that seat's entry square.

- If an opponent occupies the entry square, they're bumped back to **their** Start.
- If the player's *own* pawn occupies the entry square, the move is illegal
  (no two pawns owned by the same player ever share a space).

## Normal movement

Forward movement follows the main track, then -- once a pawn reaches its own
safety-lane entrance -- continues into that 5-space lane and then Home. This uses
a single linear "local coordinate" per pawn (0 at that pawn's own entry, 51 at its
own safety-lane entrance, 52-56 inside the lane, 57 = Home), so overshoot-Home and
safety-lane-diversion are both simple arithmetic rather than special cases.

Landing exactly on an opponent's pawn (on the main track) sends it back to that
opponent's Start. Landing on your own pawn is illegal.

Backward movement (cards 4 and 10's alternate) moves the other direction around
the shared ring. A pawn inside its own safety lane can back out of it and continue
backward around the main track if the backward distance exceeds what's left in the
lane. It is **not** bounded by its own entry point the way forward movement is --
a pawn moving backward can freely pass anyone's entry square.

## Card 7 split

Either move one pawn 7 spaces, or split the 7 between two *different* pawns (e.g.
3 + 4). The engine enumerates every combination where both legs are individually
legal, resolving the first leg before checking the second -- so a square the first
pawn vacates (or an opponent it bumps off a square) correctly affects whether the
second leg is legal. Neither leg may move a pawn still in Start.

## Card 11 swap

Swap your pawn with an opponent's, provided **both** are on the main track (not in
Start, Home, or anyone's safety lane).

## BUMP! card

Requires a pawn of yours currently in Start and an eligible opponent pawn on the
main track (same eligibility as swap: not Start/Home/safety lane). Your pawn
teleports directly onto the opponent's square; they go back to their Start. There
is no alternate "move 7" style option -- if you have no pawn in Start, or no
eligible target exists, the card yields no legal moves (Pass).

## BOOST lanes

Four original "fast travel" lanes, one associated with each color, defined by
`{startPos, endPos}` pairs in `BOOST_LANES`. If a pawn's forward (or backward)
movement lands **exactly** on a lane's start square, and that lane's color isn't
the mover's own color, the pawn is immediately carried to the lane's end square.
Any pawn resting on an intermediate square is bumped back to Start. Boost lanes
never trigger for their own owning color, and never trigger from merely passing
over the start square mid-move (only landing exactly on it).

## Protected safety lanes & Home

- Only the owning seat's pawns may ever be in their own safety lane.
- Reaching Home requires an *exact* move -- overshoot is illegal (no alternate
  legal move exists in that case, so the card may offer fewer options, or none).
- Home has no stacking limit; all 4 of a player's pawns can be Home simultaneously.
- Opponents can never swap into, land in (bump), or otherwise enter a seat's
  safety lane or Home.

## Winning

The first player to get all 4 pawns Home wins immediately -- the game stops
advancing turns at that instant (see `hasWinner` and `GameState.winnerSeat`).
