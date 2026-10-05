package com.bumprun.tv.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bumprun.tv.Settings
import com.bumprun.tv.ui.theme.BumpAccent

@Composable
fun SettingsScreen(settings: Settings, onBack: () -> Unit, onSettingsChanged: () -> Unit = {}) {
    var serverUrl by remember { mutableStateOf(settings.serverUrl) }
    var muted by remember { mutableStateOf(settings.muted) }
    var volume by remember { mutableFloatStateOf(settings.volumePercent.toFloat()) }
    var reducedMotion by remember { mutableStateOf(settings.reducedMotion) }

    Box(modifier = Modifier.fillMaxSize().padding(64.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(28.dp)) {
            Text("SETTINGS", fontSize = 40.sp, fontWeight = FontWeight.Black, color = BumpAccent)

            val fieldWidth = 420.dp

            Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.width(fieldWidth)) {
                Text("Server address", fontSize = 18.sp)
                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = {
                        serverUrl = it
                        settings.serverUrl = it
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("https://bump-run.fly.dev") },
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.width(fieldWidth),
            ) {
                Text("Mute", fontSize = 18.sp)
                Switch(checked = muted, onCheckedChange = { muted = it; settings.muted = it; onSettingsChanged() })
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.width(fieldWidth)) {
                Text("Volume: ${volume.toInt()}%", fontSize = 18.sp)
                Slider(
                    value = volume,
                    onValueChange = { volume = it; settings.volumePercent = it.toInt(); onSettingsChanged() },
                    valueRange = 0f..100f,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.width(fieldWidth),
            ) {
                Text("Reduced motion", fontSize = 18.sp)
                Switch(checked = reducedMotion, onCheckedChange = { reducedMotion = it; settings.reducedMotion = it })
            }

            Spacer(Modifier.height(8.dp))
            TvButton(text = "BACK", onClick = onBack, modifier = Modifier.width(fieldWidth))
        }
    }
}
