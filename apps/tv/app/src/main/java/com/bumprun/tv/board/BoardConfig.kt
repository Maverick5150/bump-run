package com.bumprun.tv.board

/**
 * Mirrors packages/game-engine/src/config.ts (BOARD layout constants only --
 * rules enforcement always stays server-side; the TV only needs this to draw
 * pawns in the right place). Keep these numbers in sync with the engine if
 * the board layout ever changes.
 */
object BoardConfig {
    const val MAIN_TRACK_LENGTH = 52
    const val SAFE_ZONE_LENGTH = 5

    val SEAT_ORDER = listOf("red", "blue", "green", "yellow")

    val ENTRY_OFFSET = mapOf(
        "red" to 0,
        "blue" to 13,
        "green" to 26,
        "yellow" to 39,
    )

    data class BoostLane(val id: String, val ownerColor: String, val startPos: Int, val endPos: Int)

    val BOOST_LANES = SEAT_ORDER.map { color ->
        val entry = ENTRY_OFFSET.getValue(color)
        BoostLane(
            id = "boost-$color",
            ownerColor = color,
            startPos = (entry + 6) % MAIN_TRACK_LENGTH,
            endPos = (entry + 9) % MAIN_TRACK_LENGTH,
        )
    }

    fun hexFor(seat: String): Long = when (seat) {
        "red" -> 0xFFFF5A3CL
        "blue" -> 0xFF3BA7FFL
        "green" -> 0xFF36D17AL
        "yellow" -> 0xFFFFD23FL
        else -> 0xFFAAAAAAL
    }

    fun glyphFor(seat: String): String = when (seat) {
        "red" -> "▲"
        "blue" -> "●"
        "green" -> "■"
        "yellow" -> "◆"
        else -> "?"
    }
}
