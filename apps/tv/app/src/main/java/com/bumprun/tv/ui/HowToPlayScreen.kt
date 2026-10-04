package com.bumprun.tv.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bumprun.tv.ui.theme.BumpAccent
import com.bumprun.tv.ui.theme.BumpAccent2
import com.bumprun.tv.ui.theme.BumpTextDim

private data class RuleSection(val heading: String, val points: List<String>)

private val SECTIONS = listOf(
    RuleSection(
        "Goal",
        listOf(
            "Each player races 4 pawns from Start, around the shared track, into their own protected safety lane, and Home.",
            "First player to get all 4 pawns Home wins.",
        ),
    ),
    RuleSection(
        "Taking a turn",
        listOf(
            "Draw a card. Most cards move one pawn forward that many spaces.",
            "Only a 1 or 2 can bring a pawn out of Start, onto your entry square.",
            "A 2 grants you another turn after it resolves.",
            "If a card gives you no legal move, you'll automatically pass.",
        ),
    ),
    RuleSection(
        "Bumping",
        listOf(
            "Landing exactly on an opponent's pawn sends it back to their Start.",
            "You can never land on your own pawn -- that move isn't allowed.",
            "BUMP! is a special card: it launches a pawn straight from your Start onto any eligible opponent pawn on the main track, sending them back to Start.",
        ),
    ),
    RuleSection(
        "Special cards",
        listOf(
            "4: move backward 4 spaces.",
            "7: move one pawn 7 spaces, or split the 7 across two different pawns (e.g. 3 + 4).",
            "10: move forward 10, or backward 1.",
            "11: move forward 11, or swap places with an eligible opponent pawn.",
            "BUMP!: launch a pawn from Start directly onto an opponent, sending them back to Start.",
        ),
    ),
    RuleSection(
        "BOOST lanes",
        listOf(
            "Land exactly on the start of another color's BOOST lane and you'll rocket to the end of it.",
            "Anyone resting on the spaces in between gets bumped back to their Start.",
            "Your own color's boost lane never triggers for you.",
        ),
    ),
    RuleSection(
        "Safety lane & Home",
        listOf(
            "Only your own pawns may ever enter your safety lane -- opponents can't land there, swap into it, or bump you out of it.",
            "Reaching Home requires an exact roll -- overshooting is not a legal move.",
            "All 4 of your pawns can be Home at once; there's no limit.",
        ),
    ),
)

@Composable
fun HowToPlayScreen(onBack: () -> Unit) {
    val backFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { backFocus.requestFocus() }

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 64.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.Start,
    ) {
        Text("HOW TO PLAY", fontSize = 40.sp, fontWeight = FontWeight.Black, color = BumpAccent)
        Spacer(Modifier.height(20.dp))
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            SECTIONS.forEach { section ->
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(section.heading.uppercase(), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = BumpAccent2)
                    section.points.forEach { point ->
                        Text("•  $point", fontSize = 18.sp, color = BumpTextDim, lineHeight = 25.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(20.dp))
        TvButton(text = "BACK", onClick = onBack, focusRequester = backFocus)
    }
}
