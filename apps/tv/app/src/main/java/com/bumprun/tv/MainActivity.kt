package com.bumprun.tv

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.CreationExtras
import com.bumprun.tv.net.ConnectionStatus
import com.bumprun.tv.ui.*
import com.bumprun.tv.ui.theme.BumpRunTheme

class MainActivity : ComponentActivity() {

    private val settings by lazy { Settings(applicationContext) }

    private val viewModel: AppViewModel by viewModels {
        object : ViewModelProvider.Factory {
            override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T {
                @Suppress("UNCHECKED_CAST")
                return AppViewModel(applicationContext, settings) as T
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Gameplay should never be interrupted by the screen dimming/locking mid-turn.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContent {
            BumpRunTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppRoot(viewModel)
                }
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun AppRoot(vm: AppViewModel) {
    val screen by vm.screen.collectAsState()
    val status by vm.status.collectAsState()
    val roomState by vm.roomState.collectAsState()
    val gameState by vm.gameState.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        when (screen) {
            Screen.TITLE -> TitleScreen(
                onPlay = { vm.startPlay() },
                onHowToPlay = { vm.goTo(Screen.HOW_TO_PLAY) },
                onSettings = { vm.goTo(Screen.SETTINGS) },
            )
            Screen.HOW_TO_PLAY -> {
                BackHandler { vm.goTo(Screen.TITLE) }
                HowToPlayScreen(onBack = { vm.goTo(Screen.TITLE) })
            }
            Screen.SETTINGS -> {
                BackHandler { vm.goTo(Screen.TITLE) }
                SettingsScreen(
                    settings = vm.settings,
                    onBack = { vm.goTo(Screen.TITLE) },
                    onSettingsChanged = { vm.sound.applySettings() },
                )
            }
            Screen.LOBBY -> {
                BackHandler { vm.returnToMainMenu() }
                LobbyScreen(
                    serverUrl = vm.settings.serverUrl,
                    status = status,
                    roomState = roomState,
                    onStart = { vm.startGameFromLobby() },
                )
            }
            Screen.GAME -> gameState?.let {
                GameScreen(gameState = it, roomCode = roomState?.room?.roomCode ?: "----", reducedMotion = vm.settings.reducedMotion)
            }
            Screen.WIN -> {
                BackHandler { vm.returnToMainMenu() }
                val winnerSeat = gameState?.winnerSeat
                val winnerName = gameState?.players?.firstOrNull { it.seat == winnerSeat }?.nickname
                WinScreen(
                    winnerSeat = winnerSeat,
                    winnerName = winnerName,
                    onPlayAgain = { vm.playAgain() },
                    onNewRoom = { vm.returnToMainMenu(); vm.startPlay() },
                    onMainMenu = { vm.returnToMainMenu() },
                )
            }
        }

        if (status == ConnectionStatus.CONNECTING || status == ConnectionStatus.DISCONNECTED) {
            if (screen != Screen.TITLE && screen != Screen.HOW_TO_PLAY && screen != Screen.SETTINGS && screen != Screen.LOBBY) {
                Surface(
                    modifier = Modifier.align(Alignment.BottomStart).padding(16.dp),
                    color = androidx.compose.ui.graphics.Color(0x99000000),
                ) {
                    Text(
                        if (status == ConnectionStatus.CONNECTING) "Connecting to server…" else "Can't reach game server. Retrying…",
                        modifier = Modifier.padding(12.dp),
                        color = androidx.compose.ui.graphics.Color.White,
                    )
                }
            }
        }
    }
}
