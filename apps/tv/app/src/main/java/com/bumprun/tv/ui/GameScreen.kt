package com.bumprun.tv.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bumprun.tv.board.Board
import com.bumprun.tv.net.GamePublicState
import com.bumprun.tv.net.PawnZone
import com.bumprun.tv.ui.theme.*

private val CARD_LABELS = mapOf(
    "CARD_1" to "1",
    "CARD_2" to "2",
    "CARD_3" to "3",
    "CARD_4" to "4",
    "CARD_5" to "5",
    "CARD_7" to "7",
    "CARD_8" to "8",
    "CARD_10" to "10",
    "CARD_11" to "11",
    "CARD_12" to "12",
    "BUMP" to "BUMP!",
)

@Composable
fun GameScreen(gameState: GamePublicState, roomCode: String, reducedMotion: Boolean) {
    Box(modifier = Modifier.fillMaxSize()) {
        Board(gameState = gameState, reducedMotion = reducedMotion, modifier = Modifier.fillMaxSize())

        // top bar: current turn + card
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val current = gameState.currentPlayer
            Text(
                current?.let { "${it.nickname.uppercase()}'S TURN" } ?: "WAITING…",
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                color = seatColor(current?.seat),
            )
            AnimatedVisibility(visible = gameState.activeCard != null) {
                val scale by animateFloatAsState(targetValue = if (gameState.activeCard != null) 1f else 0.6f, label = "card")
                Text(
                    CARD_LABELS[gameState.activeCard] ?: "",
                    fontSize = (40 * scale).sp,
                    fontWeight = FontWeight.Black,
                    color = BumpAccent2,
                )
            }
        }

        // bottom bar: pawns-home counts per seat
        Row(
            modifier = Modifier.fillMaxWidth().align(Alignment.BottomCenter).padding(bottom = 24.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            gameState.players.forEach { p ->
                val homeCount = p.pawns.count { it.zone is PawnZone.Home }
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(p.nickname, fontSize = 16.sp, color = seatColor(p.seat))
                    Spacer(Modifier.width(8.dp))
                    Text("$homeCount/4 Home", fontSize = 16.sp, color = BumpTextDim)
                }
            }
        }

        // room code, small and unobtrusive
        Text(
            "Room $roomCode",
            fontSize = 12.sp,
            color = BumpTextDim,
            modifier = Modifier.align(Alignment.TopEnd).padding(16.dp),
        )
    }
}
