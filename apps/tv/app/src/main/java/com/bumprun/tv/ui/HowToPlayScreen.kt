package com.bumprun.tv.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bumprun.tv.ui.theme.BumpAccent
import com.bumprun.tv.ui.theme.BumpTextDim

private val RULES = listOf(
    "Each player races four pawns from Start, around the board, into their own safety lane, and Home.",
    "Draw a card each turn. A 1 or 2 lets a pawn leave Start. Most cards move a pawn forward that many spaces.",
    "Landing exactly on an opponent sends them back to Start. Landing on your own pawn is not allowed.",
    "A 4 moves backward. A 10 can go forward 10 or backward 1. An 11 can move 11 or swap places with an eligible opponent.",
    "A 7 can move one pawn 7 spaces, or split the move across two different pawns.",
    "BUMP! launches a pawn straight from Start onto an opponent's space, sending them back to Start.",
    "Watch for BOOST lanes -- land exactly on the start of another color's boost and you'll rocket to the end of it.",
    "Only you can enter your own safety lane, and it's exact: overshooting Home is not allowed.",
    "Get all four pawns Home first to win!",
)

@Composable
fun HowToPlayScreen(onBack: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(64.dp),
        horizontalAlignment = Alignment.Start,
    ) {
        Text("HOW TO PLAY", fontSize = 40.sp, fontWeight = FontWeight.Black, color = BumpAccent)
        Spacer(Modifier.height(24.dp))
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            RULES.forEach { rule ->
                Text("•  $rule", fontSize = 20.sp, color = BumpTextDim, lineHeight = 28.sp)
            }
        }
        Spacer(Modifier.height(24.dp))
        Button(onClick = onBack) { Text("BACK") }
    }
}
