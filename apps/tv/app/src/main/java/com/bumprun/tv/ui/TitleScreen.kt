package com.bumprun.tv.ui

import androidx.compose.foundation.layout.*
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

@Composable
fun TitleScreen(
    onPlay: () -> Unit,
    onHowToPlay: () -> Unit,
    onSettings: () -> Unit,
) {
    val playFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { playFocus.requestFocus() }

    Box(modifier = Modifier.fillMaxSize().padding(64.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(32.dp)) {
            Text("BUMP RUN", fontSize = 72.sp, fontWeight = FontWeight.Black, color = BumpAccent)
            Text("Race. Bump. Win.", fontSize = 20.sp, color = BumpAccent2)
            Spacer(Modifier.height(24.dp))
            Column(verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.width(340.dp)) {
                TvButton(
                    text = "PLAY",
                    onClick = onPlay,
                    modifier = Modifier.fillMaxWidth(),
                    height = 64.dp,
                    fontSize = 22.sp,
                    containerColor = BumpAccent,
                    focusRequester = playFocus,
                )
                TvButton(text = "HOW TO PLAY", onClick = onHowToPlay, modifier = Modifier.fillMaxWidth())
                TvButton(text = "SETTINGS", onClick = onSettings, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}
