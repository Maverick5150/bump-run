package com.bumprun.tv.net

import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.Dns
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.net.Inet4Address
import java.net.InetAddress
import java.util.concurrent.TimeUnit

enum class ConnectionStatus { DISCONNECTED, CONNECTING, CONNECTED }

/**
 * Some home/ISP networks hand out a non-functional IPv6 route (present in
 * DNS, but black-holed or misconfigured) -- Android's dual-stack "happy
 * eyeballs" is supposed to fall back to IPv4 quickly, but in practice this
 * can hang or fail outright on some devices/networks well before any
 * fallback kicks in, while anything resolving IPv4-only (or on a saner
 * network) connects fine. Since that's indistinguishable from "server is
 * unreachable" from the app's point of view, and costs nothing when IPv6
 * isn't actually the problem, just skip IPv6 addresses entirely here.
 */
private object Ipv4OnlyDns : Dns {
    override fun lookup(hostname: String): List<InetAddress> {
        val all = Dns.SYSTEM.lookup(hostname)
        val ipv4Only = all.filterIsInstance<Inet4Address>()
        return ipv4Only.ifEmpty { all }
    }
}

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
    /** Raw reason from the last transport-level connect failure, for on-screen diagnostics. */
    val lastConnectErrorReason = MutableStateFlow<String?>(null)

    var roomCode: String? = null
        private set
    private var roomId: String? = null
    private var hostToken: String? = null

    fun connect(url: String) {
        if (url.isBlank()) {
            // Nothing configured yet (e.g. fresh install) -- surface this as
            // "disconnected" rather than attempting a connection to "".
            disconnect()
            serverUrl = url
            return
        }
        if (socket != null && serverUrl == url) return
        disconnect()
        serverUrl = url
        status.value = ConnectionStatus.CONNECTING
        val httpClient = OkHttpClient.Builder()
            .dns(Ipv4OnlyDns)
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
        val opts = IO.Options().apply {
            reconnection = true
            reconnectionDelay = 500
            reconnectionDelayMax = 4000
            timeout = 8000
            // Prefer websocket but allow falling back to HTTP long-polling --
            // the server supports both, and some networks interfere with the
            // websocket upgrade specifically while plain HTTPS works fine.
            transports = arrayOf("websocket", "polling")
            // Route through our own OkHttp client so DNS resolution skips
            // IPv6 (see Ipv4OnlyDns above) instead of socket.io-client's
            // default dual-stack behavior.
            callFactory = httpClient
            webSocketFactory = httpClient
        }
        val s = try {
            IO.socket(url, opts)
        } catch (e: Exception) {
            // Malformed URL typed into Settings -- don't crash the app.
            status.value = ConnectionStatus.DISCONNECTED
            return
        }
        socket = s

        s.on(Socket.EVENT_CONNECT) {
            status.value = ConnectionStatus.CONNECTED
            lastConnectErrorReason.value = null
            createOrRejoinRoom()
        }
        s.on(Socket.EVENT_DISCONNECT) { status.value = ConnectionStatus.DISCONNECTED }
        s.on(Socket.EVENT_CONNECT_ERROR) { args ->
            val reason = (args.getOrNull(0) as? Exception)?.message
                ?: args.getOrNull(0)?.toString()
                ?: "unknown error"
            lastConnectErrorReason.value = reason
        }
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

    fun startGame(botSeats: List<String> = emptyList()) {
        val payload = JSONObject()
        if (botSeats.isNotEmpty()) {
            payload.put("botSeats", org.json.JSONArray(botSeats))
        }
        socket?.emit("game:start", payload)
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
