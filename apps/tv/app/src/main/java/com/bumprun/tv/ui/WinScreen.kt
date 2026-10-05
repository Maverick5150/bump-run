package com.bumprun.tv.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bumprun.tv.board.BoardConfig
import com.bumprun.tv.ui.theme.BumpAccent
import com.bumprun.tv.ui.theme.seatColor
import kotlin.random.Random

private data class ConfettiPiece(val x: Float, val colorSeat: String, val phase: Float, val speed: Float)

@Composable
private fun ConfettiLayer() {
    val pieces = remember {
        List(60) {
            ConfettiPiece(
                x = Random.nextFloat(),
                colorSeat = BoardConfig.SEAT_ORDER[it % BoardConfig.SEAT_ORDER.size],
                phase = Random.nextFloat(),
                speed = 0.6f + Random.nextFloat() * 0.8f,
            )
        }
    }
    val transition = rememberInfiniteTransition(label = "confetti")
    val t by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(4000, easing = LinearEasing), RepeatMode.Restart),
        label = "confettiT",
    )
    Canvas(modifier = Modifier.fillMaxSize()) {
        for (p in pieces) {
            val y = ((t * p.speed + p.phase) % 1f) * size.height
            drawCircle(
                color = Color(BoardConfig.hexFor(p.colorSeat)).copy(alpha = 0.8f),
                radius = size.width * 0.006f,
                center = Offset(p.x * size.width, y),
            )
        }
    }
}

@Composable
fun WinScreen(
    winnerSeat: String?,
    winnerName: String?,
    onPlayAgain: () -> Unit,
    onNewRoom: () -> Unit,
    onMainMenu: () -> Unit,
) {
    val playAgainFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { playAgainFocus.requestFocus() }

    val pulseTransition = rememberInfiniteTransition(label = "winPulse")
    val pulse by pulseTransition.animateFloat(
        initialValue = 0.96f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "winPulseScale",
    )

    Box(modifier = Modifier.fillMaxSize()) {
        AnimatedMenuBackground(intensity = 0.4f)
        ConfettiLayer()
        Column(
            modifier = Modifier.fillMaxSize().padding(64.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                "${(winnerName ?: "SOMEONE").uppercase()} WINS!",
                fontSize = 56.sp,
                fontWeight = FontWeight.Black,
                color = seatColor(winnerSeat),
                modifier = Modifier.scale(pulse),
            )
            Spacer(Modifier.height(48.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                TvButton(text = "PLAY AGAIN", icon = "🔁", onClick = onPlayAgain, containerColor = BumpAccent, focusRequester = playAgainFocus)
                TvButton(text = "NEW ROOM", icon = "🆕", onClick = onNewRoom)
                TvButton(text = "MAIN MENU", icon = "🏠", onClick = onMainMenu)
            }
        }
    }
}
