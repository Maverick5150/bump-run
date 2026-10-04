package com.bumprun.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bumprun.tv.net.ConnectionStatus
import com.bumprun.tv.net.RoomStatePayload
import com.bumprun.tv.ui.theme.*

@Composable
fun LobbyScreen(
    serverUrl: String,
    status: ConnectionStatus,
    roomState: RoomStatePayload?,
    onStart: () -> Unit,
) {
    val roomCode = roomState?.room?.roomCode

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
                Text("CAN'T REACH SERVER", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = BumpAccent)
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
                    "Go to SETTINGS and enter the address your computer prints\nwhen you run the server (pnpm run dev:lan).",
                    fontSize = 14.sp,
                    color = BumpTextDim,
                )
            }
        }

        // Right: player list + start button
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.Center) {
            Text("PLAYERS", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = BumpAccent)
            Spacer(Modifier.height(16.dp))
            val players = roomState?.players.orEmpty()
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
            Spacer(Modifier.height(32.dp))
            val readyCount = players.count { it.ready && it.seat != null }
            val canStart = readyCount >= 2
            val startFocus = remember { FocusRequester() }
            LaunchedEffect(canStart) {
                if (canStart) startFocus.requestFocus()
            }
            TvButton(
                text = if (canStart) "START GAME" else "NEED 2+ READY PLAYERS",
                onClick = onStart,
                enabled = canStart,
                modifier = Modifier.fillMaxWidth(),
                height = 60.dp,
                containerColor = BumpAccent,
                focusRequester = startFocus,
            )
        }
    }
}
