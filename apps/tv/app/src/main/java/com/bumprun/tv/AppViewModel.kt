package com.bumprun.tv

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bumprun.tv.audio.SoundEngine
import com.bumprun.tv.net.ConnectionStatus
import com.bumprun.tv.net.SocketManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

enum class Screen { TITLE, HOW_TO_PLAY, SETTINGS, LOBBY, GAME, WIN }

class AppViewModel(val settings: Settings) : ViewModel() {
    val socket = SocketManager()
    val sound = SoundEngine(settings)

    private val _screen = MutableStateFlow(Screen.TITLE)
    val screen: StateFlow<Screen> = _screen

    val status get() = socket.status
    val roomState get() = socket.roomState
    val gameState get() = socket.gameState

    private var lastHandledEventIdentity: Any? = null

    init {
        viewModelScope.launch {
            socket.lastEvent.collect { event ->
                if (event == null || event === lastHandledEventIdentity) return@collect
                lastHandledEventIdentity = event
                when (event.type) {
                    "cardDrawn" -> sound.cardDraw()
                    "bumped" -> sound.bump()
                    "boostTriggered" -> sound.boost()
                    "gameWon" -> {
                        sound.winFanfare()
                        goTo(Screen.WIN)
                    }
                }
            }
        }
        viewModelScope.launch {
            socket.gameState.collect { state ->
                if (state != null && _screen.value == Screen.LOBBY) goTo(Screen.GAME)
                if (state?.winnerSeat != null) goTo(Screen.WIN)
            }
        }
    }

    fun goTo(screen: Screen) {
        sound.menuSelect()
        _screen.value = screen
    }

    fun startPlay() {
        socket.connect(settings.serverUrl)
        goTo(Screen.LOBBY)
    }

    fun startGameFromLobby() {
        socket.startGame()
    }

    fun playAgain() {
        socket.playAgain()
        goTo(Screen.LOBBY)
    }

    fun returnToMainMenu() {
        socket.disconnect()
        goTo(Screen.TITLE)
    }

    override fun onCleared() {
        sound.release()
        socket.disconnect()
    }
}
