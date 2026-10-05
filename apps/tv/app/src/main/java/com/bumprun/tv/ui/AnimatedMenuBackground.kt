package com.bumprun.tv.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.bumprun.tv.board.BoardConfig
import com.bumprun.tv.ui.theme.BumpAccent
import com.bumprun.tv.ui.theme.BumpAccent2
import com.bumprun.tv.ui.theme.BumpBackground
import com.bumprun.tv.ui.theme.BumpSurface
import kotlin.math.cos
import kotlin.math.sin

private data class Glow(val baseX: Float, val baseY: Float, val radiusFrac: Float, val color: Color, val phase: Float, val speed: Float)

/**
 * Shared "menu skin" background for every non-gameplay screen: a slow
 * diagonal gradient sweep, a few drifting soft-glow orbs in the brand
 * colors, and a thin animated track strip along the bottom with the 4 seat
 * colors looping around it -- a quiet nod to the board itself. Pure Canvas
 * drawing, no image assets.
 */
@Composable
fun AnimatedMenuBackground(modifier: Modifier = Modifier, intensity: Float = 1f) {
    val glows = remember {
        listOf(
            Glow(0.16f, 0.22f, 0.30f, BumpAccent, 0.0f, 0.55f),
            Glow(0.86f, 0.18f, 0.24f, BumpAccent2, 1.9f, 0.45f),
            Glow(0.50f, 0.90f, 0.32f, BumpAccent, 3.4f, 0.35f),
            Glow(0.78f, 0.68f, 0.20f, BumpAccent2, 5.1f, 0.6f),
        )
    }
    val pawns = remember {
        BoardConfig.SEAT_ORDER.mapIndexed { i, seat -> seat to i / BoardConfig.SEAT_ORDER.size.toFloat() }
    }

    val transition = rememberInfiniteTransition(label = "menuBg")
    val sweep by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(22000, easing = LinearEasing), RepeatMode.Restart),
        label = "sweep",
    )
    val drift by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(26000, easing = LinearEasing), RepeatMode.Restart),
        label = "drift",
    )
    val track by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(8000, easing = LinearEasing), RepeatMode.Restart),
        label = "track",
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        drawRect(color = BumpBackground)
        drawRect(
            brush = Brush.linearGradient(
                colors = listOf(BumpBackground, BumpSurface.copy(alpha = 0.9f), BumpBackground),
                start = Offset(size.width * (sweep * 2.4f - 0.7f), 0f),
                end = Offset(size.width * (sweep * 2.4f + 0.3f), size.height),
            ),
        )

        for (g in glows) {
            val angle = drift * g.speed + g.phase
            val cx = (g.baseX + cos(angle) * 0.035f) * size.width
            val cy = (g.baseY + sin(angle) * 0.035f) * size.height
            val r = g.radiusFrac * size.minDimension * 2.4f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(g.color.copy(alpha = 0.20f * intensity), g.color.copy(alpha = 0f)),
                    center = Offset(cx, cy),
                    radius = r,
                ),
                radius = r,
                center = Offset(cx, cy),
            )
        }

        val trackY = size.height - 28f
        drawLine(
            color = Color.White.copy(alpha = 0.05f * intensity),
            start = Offset(0f, trackY),
            end = Offset(size.width, trackY),
            strokeWidth = 2f,
        )
        for ((seat, phase) in pawns) {
            val x = ((track + phase) % 1f) * size.width
            drawCircle(
                color = Color(BoardConfig.hexFor(seat)).copy(alpha = 0.8f * intensity),
                radius = 6f,
                center = Offset(x, trackY),
            )
        }
    }
}
