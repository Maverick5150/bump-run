package com.bumprun.tv.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
    Box(modifier = Modifier.fillMaxSize().padding(64.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(32.dp)) {
            Text(
                buildString { append("BUMP RUN") },
                fontSize = 72.sp,
                fontWeight = FontWeight.Black,
                color = BumpAccent,
            )
            Text("Race. Bump. Win.", fontSize = 20.sp, color = BumpAccent2)
            Spacer(Modifier.height(24.dp))
            Column(verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.width(320.dp)) {
                Button(onClick = onPlay, modifier = Modifier.fillMaxWidth().height(64.dp), colors = ButtonDefaults.buttonColors(containerColor = BumpAccent)) {
                    Text("PLAY", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }
                Button(onClick = onHowToPlay, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                    Text("HOW TO PLAY", fontSize = 18.sp)
                }
                Button(onClick = onSettings, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                    Text("SETTINGS", fontSize = 18.sp)
                }
            }
        }
    }
}
