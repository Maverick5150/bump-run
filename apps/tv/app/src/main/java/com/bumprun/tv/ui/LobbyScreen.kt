package com.bumprun.tv.ui

import androidx.compose.animation.core.tween
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bumprun.tv.board.BoardConfig
import com.bumprun.tv.net.ConnectionStatus
import com.bumprun.tv.net.RoomStatePayload
import com.bumprun.tv.ui.theme.*

@Composable
fun LobbyScreen(
    serverUrl: String,
    status: ConnectionStatus,
    roomState: RoomStatePayload?,
    connectErrorReason: String? = null,
    onStart: (botSeats: List<String>) -> Unit,
) {
    val roomCode = roomState?.room?.roomCode

    Box(modifier = Modifier.fillMaxSize()) {
    AnimatedMenuBackground(intensity = 0.45f)
    Row(modifier = Modifier.fillMaxSize().padding(48.dp), horizontalArrangement = Arrangement.spacedBy(48.dp)) {
        // Left: QR + room code + URL, or a clear "can't reach server" state
        Column(
            modifier = Modifier.weight(1f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            if (roomCode != null) {
                val joinUrl = "${serverUrl.trimEnd('/')}/join/$roomCode"
                Text("SCAN TO JOIN", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = BumpAccent2)
                Spacer(Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .size(260.dp)
                        .background(Color.White, RoundedCornerShape(12.dp))
                        .padding(12.dp),
                ) {
                    QrCodeImage(content = joinUrl, modifier = Modifier.fillMaxSize())
                }
                Spacer(Modifier.height(20.dp))
                Text("Room: $roomCode", fontSize = 36.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(8.dp))
                Text(joinUrl, fontSize = 14.sp, color = BumpTextDim)
            } else {
                val pulseTransition = rememberInfiniteTransition(label = "retryPulse")
                val pulseAlpha by pulseTransition.animateFloat(
                    initialValue = 0.4f,
                    targetValue = 1f,
                    animationSpec = infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
                    label = "retryPulseAlpha",
                )
                Text(
                    "CAN'T REACH SERVER",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = BumpAccent,
                    modifier = Modifier.alpha(pulseAlpha),
                )
                Spacer(Modifier.height(16.dp))
                Text(
                    if (status == ConnectionStatus.CONNECTING) "Connecting…" else "Retrying…",
                    fontSize = 18.sp,
                    color = BumpTextDim,
                )
                Spacer(Modifier.height(20.dp))
                if (serverUrl.isBlank()) {
                    Text("No server address configured yet.", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                } else {
                    Text("Trying to reach:", fontSize = 14.sp, color = BumpTextDim)
                    Text(serverUrl, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(20.dp))
                Text(
                    "Go to SETTINGS and double-check the server address.\nThis should normally be left as the default.",
                    fontSize = 14.sp,
                    color = BumpTextDim,
                )
                if (!connectErrorReason.isNullOrBlank()) {
                    Spacer(Modifier.height(20.dp))
                    Text("Details: $connectErrorReason", fontSize = 12.sp, color = BumpTextDim)
                }
            }
        }

        // Right: player list + AI slots + start button
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.Center) {
            Text("PLAYERS", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = BumpAccent)
            Spacer(Modifier.height(16.dp))
            val players = roomState?.players.orEmpty()
            val humanTakenSeats = players.mapNotNull { it.seat }.toSet()
            val openSeats = BoardConfig.SEAT_ORDER.filter { it !in humanTakenSeats }

            var aiCount by remember { mutableStateOf(0) }
            LaunchedEffect(openSeats.size) {
                if (aiCount > openSeats.size) aiCount = openSeats.size
            }
            val botSeats = openSeats.take(aiCount)

            if (players.isEmpty()) {
                Text("Waiting for players to join…", fontSize = 18.sp, color = BumpTextDim)
            }
            players.forEach { p ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                ) {
                    Box(modifier = Modifier.size(20.dp).clip(CircleShape).background(seatColor(p.seat)))
                    Spacer(Modifier.width(12.dp))
                    Text(p.nickname, fontSize = 20.sp, modifier = Modifier.weight(1f))
                    Text(
                        if (p.ready) "READY" else "Waiting…",
                        fontSize = 16.sp,
                        fontWeight = if (p.ready) FontWeight.Bold else FontWeight.Normal,
                        color = if (p.ready) BumpAccent2 else BumpTextDim,
                    )
                }
            }
            botSeats.forEach { seat ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                ) {
                    Box(modifier = Modifier.size(20.dp).clip(CircleShape).background(seatColor(seat)))
                    Spacer(Modifier.width(12.dp))
                    Text("AI ${seat.replaceFirstChar { it.uppercase() }}", fontSize = 20.sp, modifier = Modifier.weight(1f))
                    Text("🤖", fontSize = 16.sp, color = BumpAccent2)
                }
            }

            if (openSeats.isNotEmpty()) {
                Spacer(Modifier.height(20.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text("AI PLAYERS", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = BumpTextDim)
                    TvButton(
                        text = "−",
                        onClick = { aiCount = (aiCount - 1).coerceAtLeast(0) },
                        enabled = aiCount > 0,
                        height = 40.dp,
                        modifier = Modifier.width(52.dp),
                    )
                    Text("$aiCount", fontSize = 20.sp, fontWeight = FontWeight.Black)
                    TvButton(
                        text = "+",
                        onClick = { aiCount = (aiCount + 1).coerceAtMost(openSeats.size) },
                        enabled = aiCount < openSeats.size,
                        height = 40.dp,
                        modifier = Modifier.width(52.dp),
                    )
                }
            }

            Spacer(Modifier.height(32.dp))
            val readyPlayers = players.filter { it.ready && it.seat != null }
            val canStart = readyPlayers.isNotEmpty() && (readyPlayers.size + botSeats.size) >= 2
            val startFocus = remember { FocusRequester() }
            LaunchedEffect(canStart) {
                if (canStart) startFocus.requestFocus()
            }
            TvButton(
                text = when {
                    canStart -> "START GAME"
                    readyPlayers.isEmpty() -> "WAITING FOR A PLAYER"
                    else -> "ADD AI OR A 2ND PLAYER"
                },
                icon = if (canStart) "▶" else null,
                onClick = { onStart(botSeats) },
                enabled = canStart,
                modifier = Modifier.fillMaxWidth(),
                height = 60.dp,
                containerColor = BumpAccent,
                focusRequester = startFocus,
            )
        }
    }
    }
}
