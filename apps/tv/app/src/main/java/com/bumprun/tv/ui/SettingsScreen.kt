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
fun SettingsScreen(settings: Settings, onBack: () -> Unit) {
    var serverUrl by remember { mutableStateOf(settings.serverUrl) }
    var muted by remember { mutableStateOf(settings.muted) }
    var volume by remember { mutableFloatStateOf(settings.volumePercent.toFloat()) }
    var reducedMotion by remember { mutableStateOf(settings.reducedMotion) }

    Column(modifier = Modifier.fillMaxSize().padding(64.dp), verticalArrangement = Arrangement.spacedBy(28.dp)) {
        Text("SETTINGS", fontSize = 40.sp, fontWeight = FontWeight.Black, color = BumpAccent)

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Server address", fontSize = 18.sp)
            OutlinedTextField(
                value = serverUrl,
                onValueChange = {
                    serverUrl = it
                    settings.serverUrl = it
                },
                modifier = Modifier.width(480.dp),
                singleLine = true,
                placeholder = { Text("http://192.168.1.50:3000") },
            )
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Mute", fontSize = 18.sp, modifier = Modifier.width(180.dp))
            Switch(checked = muted, onCheckedChange = { muted = it; settings.muted = it })
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Volume: ${volume.toInt()}%", fontSize = 18.sp)
            Slider(
                value = volume,
                onValueChange = { volume = it; settings.volumePercent = it.toInt() },
                valueRange = 0f..100f,
                modifier = Modifier.width(400.dp),
            )
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Reduced motion", fontSize = 18.sp, modifier = Modifier.width(180.dp))
            Switch(checked = reducedMotion, onCheckedChange = { reducedMotion = it; settings.reducedMotion = it })
        }

        Spacer(Modifier.weight(1f))
        TvButton(text = "BACK", onClick = onBack)
    }
}
