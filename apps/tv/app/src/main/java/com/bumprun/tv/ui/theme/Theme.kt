package com.bumprun.tv.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val BumpBackground = Color(0xFF14121F)
val BumpSurface = Color(0xFF1E1B2E)
val BumpCard = Color(0xFF262240)
val BumpAccent = Color(0xFFFF5A3C)
val BumpAccent2 = Color(0xFF2DE0C8)
val BumpTextDim = Color(0xFFA9A3C4)

val SeatRed = Color(0xFFFF5A3C)
val SeatBlue = Color(0xFF3BA7FF)
val SeatGreen = Color(0xFF36D17A)
val SeatYellow = Color(0xFFFFD23F)

fun seatColor(seat: String?): Color = when (seat) {
    "red" -> SeatRed
    "blue" -> SeatBlue
    "green" -> SeatGreen
    "yellow" -> SeatYellow
    else -> BumpTextDim
}

private val BumpRunColorScheme = darkColorScheme(
    primary = BumpAccent,
    secondary = BumpAccent2,
    background = BumpBackground,
    surface = BumpSurface,
)

@Composable
fun BumpRunTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = BumpRunColorScheme, content = content)
}
