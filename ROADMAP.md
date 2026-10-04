# Roadmap

Version 1 (this repository, as built) intentionally does **not** include the
following. They're documented here so they're not forgotten, not because any of
them are half-built.

- Custom board themes / visual skins
- 6-player mode
- Private online invitations (beyond LAN + whatever public URL you deploy to)
- CPU/bot players
- Spectator mode (the room/session model was designed to allow adding this later
  without a rework, but it isn't implemented)
- Persistent player profiles / accounts
- Cross-game statistics (only per-game stats exist today, via
  `PlayerStats` on each player for that single game)
- Achievements
- Alternate rule sets / house rules toggle
- Tournament brackets
- Custom decks beyond editing `DECK_COMPOSITION`
- Additional accessibility themes beyond the existing color+glyph+label
  differentiation and reduced-motion setting
- A native Android phone app (the controller is deliberately browser-only)
- An iOS companion app
- Amazon Vega OS native client, or other smart-TV platforms beyond Android TV /
  Fire OS
- Per-pawn square-by-square animation tweening is implemented for the TV board;
  a nicer eased/staggered multi-hop animation (rather than one continuous tween
  to the final square) would be a reasonable follow-up
- Dedicated automated tests for the phone controller's React components and an
  instrumented UI test suite for the Android TV app (both were verified manually
  during development; see `docs/testing.md`)
