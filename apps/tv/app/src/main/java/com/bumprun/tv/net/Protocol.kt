package com.bumprun.tv.net

import org.json.JSONObject

/** org.json has no nullable String overload for optString; this fills that gap cleanly. */
private fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key) || !has(key)) null else getString(key)

sealed class PawnZone {
    object Start : PawnZone()
    data class Main(val pos: Int) : PawnZone()
    data class Safe(val index: Int) : PawnZone()
    object Home : PawnZone()

    companion object {
        fun parse(json: JSONObject): PawnZone = when (json.getString("zone")) {
            "main" -> Main(json.getInt("pos"))
            "safe" -> Safe(json.getInt("index"))
            "home" -> Home
            else -> Start
        }
    }
}

data class PawnInfo(val id: String, val ownerSeat: String, val zone: PawnZone)

data class PlayerPublic(
    val playerId: String,
    val seat: String?,
    val nickname: String,
    val ready: Boolean,
    val connected: Boolean,
    val pawns: List<PawnInfo> = emptyList(),
)

data class RoomSummaryInfo(val roomCode: String, val roomId: String, val phase: String)

data class GameEventInfo(val type: String, val payload: JSONObject)

data class GamePublicState(
    val phase: String,
    val players: List<PlayerPublic>,
    val currentPlayerIndex: Int,
    val activeCard: String?,
    val winnerSeat: String?,
    val turnCount: Int,
    val deckCount: Int,
    val lastEvents: List<GameEventInfo>,
) {
    val currentPlayer: PlayerPublic? get() = players.getOrNull(currentPlayerIndex)

    companion object {
        fun parse(json: JSONObject): GamePublicState {
            val playersJson = json.getJSONArray("players")
            val players = (0 until playersJson.length()).map { i ->
                val p = playersJson.getJSONObject(i)
                val pawnsJson = p.getJSONArray("pawns")
                val pawns = (0 until pawnsJson.length()).map { j ->
                    val pw = pawnsJson.getJSONObject(j)
                    PawnInfo(
                        id = pw.getString("id"),
                        ownerSeat = pw.getString("ownerSeat"),
                        zone = PawnZone.parse(pw.getJSONObject("location")),
                    )
                }
                PlayerPublic(
                    playerId = p.getString("playerId"),
                    seat = p.optStringOrNull("seat")?.takeUnless { it.isEmpty() },
                    nickname = p.getString("nickname"),
                    ready = p.optBoolean("ready", false),
                    connected = p.optBoolean("connected", false),
                    pawns = pawns,
                )
            }
            val eventsJson = json.optJSONArray("lastEvents")
            val events = if (eventsJson != null) {
                (0 until eventsJson.length()).map { i ->
                    val e = eventsJson.getJSONObject(i)
                    GameEventInfo(e.getString("type"), e.optJSONObject("payload") ?: JSONObject())
                }
            } else emptyList()

            return GamePublicState(
                phase = json.getString("phase"),
                players = players,
                currentPlayerIndex = json.getInt("currentPlayerIndex"),
                activeCard = json.optStringOrNull("activeCard")?.takeUnless { it.isEmpty() },
                winnerSeat = json.optStringOrNull("winnerSeat")?.takeUnless { it.isEmpty() },
                turnCount = json.optInt("turnCount", 0),
                deckCount = json.optInt("deckCount", 0),
                lastEvents = events,
            )
        }
    }
}

data class RoomPlayerSummary(
    val playerId: String,
    val seat: String?,
    val nickname: String,
    val ready: Boolean,
    val connected: Boolean,
)

data class RoomStatePayload(val room: RoomSummaryInfo, val players: List<RoomPlayerSummary>) {
    companion object {
        fun parse(json: JSONObject): RoomStatePayload {
            val roomJson = json.getJSONObject("room")
            val room = RoomSummaryInfo(
                roomCode = roomJson.getString("roomCode"),
                roomId = roomJson.getString("roomId"),
                phase = roomJson.getString("phase"),
            )
            val playersJson = json.getJSONArray("players")
            val players = (0 until playersJson.length()).map { i ->
                val p = playersJson.getJSONObject(i)
                RoomPlayerSummary(
                    playerId = p.getString("playerId"),
                    seat = p.optStringOrNull("seat")?.takeUnless { it.isEmpty() },
                    nickname = p.getString("nickname"),
                    ready = p.optBoolean("ready", false),
                    connected = p.optBoolean("connected", false),
                )
            }
            return RoomStatePayload(room, players)
        }
    }
}
