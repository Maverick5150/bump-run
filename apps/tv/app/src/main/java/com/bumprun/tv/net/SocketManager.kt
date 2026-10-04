package com.bumprun.tv.net

import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject

enum class ConnectionStatus { DISCONNECTED, CONNECTING, CONNECTED }

/**
 * Thin wrapper around the Socket.IO client implementing the TV's half of
 * docs/protocol.md. The TV is always the "host" role for whichever room it
 * creates. All game-rule authority lives on the server; this class only
 * relays events and parses them into the small Kotlin data classes the UI
 * needs to render.
 */
class SocketManager {
    private var socket: Socket? = null
    private var serverUrl: String = ""

    val status = MutableStateFlow(ConnectionStatus.DISCONNECTED)
    val roomState = MutableStateFlow<RoomStatePayload?>(null)
    val gameState = MutableStateFlow<GamePublicState?>(null)
    val lastEvent = MutableStateFlow<GameEventInfo?>(null)
    val lastError = MutableStateFlow<String?>(null)

    var roomCode: String? = null
        private set
    private var roomId: String? = null
    private var hostToken: String? = null

    fun connect(url: String) {
        if (socket != null && serverUrl == url) return
        disconnect()
        serverUrl = url
        status.value = ConnectionStatus.CONNECTING
        val opts = IO.Options().apply {
            reconnection = true
            reconnectionDelay = 500
            reconnectionDelayMax = 4000
            transports = arrayOf("websocket")
        }
        val s = IO.socket(url, opts)
        socket = s

        s.on(Socket.EVENT_CONNECT) {
            status.value = ConnectionStatus.CONNECTED
            createOrRejoinRoom()
        }
        s.on(Socket.EVENT_DISCONNECT) { status.value = ConnectionStatus.DISCONNECTED }
        s.on("room:state") { args -> roomState.value = RoomStatePayload.parse(args[0] as JSONObject) }
        s.on("game:started") { args -> gameState.value = GamePublicState.parse((args[0] as JSONObject).getJSONObject("state")) }
        s.on("game:publicState") { args -> gameState.value = GamePublicState.parse((args[0] as JSONObject).getJSONObject("state")) }
        s.on("move:resolved") { args -> gameState.value = GamePublicState.parse((args[0] as JSONObject).getJSONObject("state")) }
        s.on("turn:cardDrawn") { args -> lastEvent.value = GameEventInfo("cardDrawn", args[0] as JSONObject) }
        s.on("player:bumped") { args -> lastEvent.value = GameEventInfo("bumped", args[0] as JSONObject) }
        s.on("boost:triggered") { args -> lastEvent.value = GameEventInfo("boostTriggered", args[0] as JSONObject) }
        s.on("game:won") { args -> lastEvent.value = GameEventInfo("gameWon", args[0] as JSONObject) }
        s.on("room:error") { args ->
            val err = args[0] as JSONObject
            lastError.value = err.optString("message", "Something went wrong.")
        }

        s.connect()
    }

    private fun createOrRejoinRoom() {
        val payload = JSONObject()
        if (roomId != null && hostToken != null) {
            payload.put("rejoinRoomId", roomId)
            payload.put("rejoinHostToken", hostToken)
        }
        socket?.emit("room:create", payload, Ack { data ->
            roomCode = data.optString("roomCode")
            roomId = data.optString("roomId")
            hostToken = data.optString("hostToken")
        })
    }

    fun startGame() {
        socket?.emit("game:start", JSONObject())
    }

    fun playAgain() {
        socket?.emit("game:playAgain", JSONObject())
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        status.value = ConnectionStatus.DISCONNECTED
    }

    /** Small helper so Socket.IO's Java-style Ack ([JSONObject] -> Unit) reads nicely from Kotlin. */
    private fun Ack(onAck: (JSONObject) -> Unit): Emitter.Listener = Emitter.Listener { args ->
        (args.getOrNull(0) as? JSONObject)?.let { ack ->
            val data = ack.optJSONObject("data")
            if (ack.optBoolean("ok", false) && data != null) onAck(data)
        }
    }
}
