package com.bumprun.tv.board

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import com.bumprun.tv.net.GamePublicState
import com.bumprun.tv.net.PawnZone

@Composable
private fun animatedOffset(target: Offset, reducedMotion: Boolean): Offset {
    val anim = remember { Animatable(target, Offset.VectorConverter) }
    LaunchedEffect(target, reducedMotion) {
        if (reducedMotion) anim.snapTo(target) else anim.animateTo(target, animationSpec = tween(320))
    }
    return anim.value
}

@Composable
fun Board(gameState: GamePublicState, reducedMotion: Boolean, modifier: Modifier = Modifier) {
    val density = LocalDensity.current
    BoxWithConstraints(modifier) {
        val sizeDp = if (maxWidth < maxHeight) maxWidth else maxHeight
        val sizePx = with(density) { sizeDp.toPx() }
        val center = Offset(sizePx / 2f, sizePx / 2f)
        val trackRadius = sizePx * 0.33f
        val geometry = remember(sizePx) { BoardGeometry(center, trackRadius) }

        data class Drawn(val seat: String, val offset: Offset, val isCurrent: Boolean)

        val currentSeat = gameState.currentPlayer?.seat
        val drawn = mutableListOf<Drawn>()
        for (player in gameState.players) {
            var startIdx = 0
            for (pawn in player.pawns) {
                val idxInStart = if (pawn.zone is PawnZone.Start) startIdx++ else 0
                val target = geometry.offsetFor(pawn.zone, pawn.ownerSeat, idxInStart)
                val animated = key(pawn.id) { animatedOffset(target, reducedMotion) }
                drawn.add(Drawn(pawn.ownerSeat, animated, player.seat == currentSeat))
            }
        }

        Canvas(modifier = Modifier.size(sizeDp)) {
            // main track ring
            drawCircle(color = Color(0xFF2A2648), radius = trackRadius, center = center, style = Stroke(width = sizePx * 0.028f))

            // 52 tick marks
            for (pos in 0 until BoardConfig.MAIN_TRACK_LENGTH) {
                val p = geometry.pointOnRing(pos)
                drawCircle(color = Color(0xFF3A3458), radius = sizePx * 0.006f, center = p)
            }

            // safe lanes + home pockets per seat
            for (seat in BoardConfig.SEAT_ORDER) {
                val seatColor = Color(BoardConfig.hexFor(seat))
                for (i in 1..BoardConfig.SAFE_ZONE_LENGTH) {
                    drawCircle(color = seatColor.copy(alpha = 0.35f), radius = sizePx * 0.012f, center = geometry.safeCellPoint(seat, i))
                }
                drawCircle(color = seatColor.copy(alpha = 0.5f), radius = sizePx * 0.035f, center = geometry.homePoint(seat))
            }

            // boost lanes (highlighted arcs on the ring)
            for (lane in BoardConfig.BOOST_LANES) {
                val start = geometry.pointOnRing(lane.startPos)
                val end = geometry.pointOnRing(lane.endPos)
                drawCircle(color = Color(BoardConfig.hexFor(lane.ownerColor)).copy(alpha = 0.25f), radius = sizePx * 0.016f, center = start)
                drawCircle(color = Color(BoardConfig.hexFor(lane.ownerColor)).copy(alpha = 0.55f), radius = sizePx * 0.016f, center = end)
            }

            // pawns
            drawn.forEach { d ->
                val c = Color(BoardConfig.hexFor(d.seat))
                if (d.isCurrent) {
                    drawCircle(color = c.copy(alpha = 0.35f), radius = sizePx * 0.028f, center = d.offset)
                }
                drawCircle(color = c, radius = sizePx * 0.018f, center = d.offset)
                drawCircle(color = Color.White.copy(alpha = 0.8f), radius = sizePx * 0.018f, center = d.offset, style = Stroke(width = sizePx * 0.003f))
            }
        }
    }
}
