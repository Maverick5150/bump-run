package com.bumprun.tv.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bumprun.tv.ui.theme.BumpAccent
import com.bumprun.tv.ui.theme.BumpAccent2
import kotlinx.coroutines.delay

@Composable
fun TitleScreen(
    onPlay: () -> Unit,
    onHowToPlay: () -> Unit,
    onSettings: () -> Unit,
) {
    val playFocus = remember { FocusRequester() }
    var logoIn by remember { mutableStateOf(false) }
    var buttonsIn by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        logoIn = true
        delay(220)
        buttonsIn = true
        delay(160)
        playFocus.requestFocus()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AnimatedMenuBackground()

        Box(modifier = Modifier.fillMaxSize().padding(64.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(32.dp)) {
                AnimatedVisibility(
                    visible = logoIn,
                    enter = fadeIn(tween(500)) + slideInVertically(tween(500)) { -it / 3 },
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("BUMP RUN", fontSize = 72.sp, fontWeight = FontWeight.Black, color = BumpAccent)
                        Text("Race. Bump. Win.", fontSize = 20.sp, color = BumpAccent2)
                    }
                }
                Spacer(Modifier.height(24.dp))
                AnimatedVisibility(
                    visible = buttonsIn,
                    enter = fadeIn(tween(450)) + slideInVertically(tween(450)) { it / 4 },
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.width(340.dp)) {
                        TvButton(
                            text = "PLAY",
                            icon = "▶",
                            onClick = onPlay,
                            modifier = Modifier.fillMaxWidth(),
                            height = 64.dp,
                            fontSize = 22.sp,
                            containerColor = BumpAccent,
                            focusRequester = playFocus,
                        )
                        TvButton(text = "HOW TO PLAY", icon = "📖", onClick = onHowToPlay, modifier = Modifier.fillMaxWidth())
                        TvButton(text = "SETTINGS", icon = "⚙", onClick = onSettings, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
}
