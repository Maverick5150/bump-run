package com.bumprun.tv.board

import androidx.compose.ui.geometry.Offset
import com.bumprun.tv.net.PawnZone
import kotlin.math.cos
import kotlin.math.sin

/**
 * Original circular board layout: the 52 shared main-track spaces sit on a
 * ring; each seat's 5-space safety lane extends radially inward from that
 * seat's own spoke toward a small "home pocket" near the center. This is
 * deliberately NOT the geometry of any commercial board -- just a clean,
 * readable shape for a TV screen.
 */
class BoardGeometry(private val center: Offset, private val trackRadius: Float) {
    private val safeSpan = trackRadius * 0.62f
    private val homeRadius = trackRadius * 0.18f

    private fun angleForMainPos(pos: Int): Double {
        val fraction = pos.toDouble() / BoardConfig.MAIN_TRACK_LENGTH
        return fraction * 2 * Math.PI - Math.PI / 2
    }

    private fun angleForSeat(seat: String): Double = angleForMainPos(BoardConfig.ENTRY_OFFSET.getValue(seat))

    fun pointOnRing(pos: Int): Offset {
        val a = angleForMainPos(pos)
        return Offset(center.x + (cos(a) * trackRadius).toFloat(), center.y + (sin(a) * trackRadius).toFloat())
    }

    private fun pointOnSpoke(seat: String, radius: Float): Offset {
        val a = angleForSeat(seat)
        return Offset(center.x + (cos(a) * radius).toFloat(), center.y + (sin(a) * radius).toFloat())
    }

    fun safeCellPoint(seat: String, index: Int): Offset {
        // index 1..5, index 5 closest to the home pocket
        val t = index / (BoardConfig.SAFE_ZONE_LENGTH + 1f)
        val radius = trackRadius - safeSpan * t
        return pointOnSpoke(seat, radius)
    }

    fun homePoint(seat: String): Offset {
        val a = angleForSeat(seat)
        // small ring of 4 home pockets near the center, one per seat
        return Offset(
            center.x + (cos(a) * homeRadius).toFloat(),
            center.y + (sin(a) * homeRadius).toFloat(),
        )
    }

    fun startClusterPoint(seat: String, pawnIndex: Int): Offset {
        val a = angleForSeat(seat)
        val base = Offset(
            center.x + (cos(a) * trackRadius * 1.22f).toFloat(),
            center.y + (sin(a) * trackRadius * 1.22f).toFloat(),
        )
        val jitterRadius = trackRadius * 0.08f
        val jitterAngle = a + (pawnIndex - 1.5) * 0.5
        return Offset(
            base.x + (cos(jitterAngle) * jitterRadius).toFloat(),
            base.y + (sin(jitterAngle) * jitterRadius).toFloat(),
        )
    }

    fun offsetFor(zone: PawnZone, seat: String, pawnIndexInOwnStart: Int): Offset = when (zone) {
        is PawnZone.Start -> startClusterPoint(seat, pawnIndexInOwnStart)
        is PawnZone.Main -> pointOnRing(zone.pos)
        is PawnZone.Safe -> safeCellPoint(seat, zone.index)
        is PawnZone.Home -> homePoint(seat)
    }
}
