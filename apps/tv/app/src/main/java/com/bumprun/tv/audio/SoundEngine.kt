package com.bumprun.tv.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.SoundPool
import com.bumprun.tv.R
import com.bumprun.tv.Settings

/**
 * Sound effects are short original clips synthesized offline (see
 * apps/tv/audio-gen/generate-audio.mjs -- pure oscillator/noise math, no
 * samples, nothing copyrighted) and played back through SoundPool. The
 * background music bed is a longer synthesized loop played through a
 * looping MediaPlayer.
 */
class SoundEngine(context: Context, private val settings: Settings) {
    private val appContext = context.applicationContext

    private val soundPool = SoundPool.Builder()
        .setMaxStreams(6)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        .build()

    private val loadedIds = HashSet<Int>()
    private val soundIds = mapOf(
        Sfx.SELECT to soundPool.load(appContext, R.raw.sfx_select, 1),
        Sfx.CARD to soundPool.load(appContext, R.raw.sfx_card, 1),
        Sfx.MOVE to soundPool.load(appContext, R.raw.sfx_move, 1),
        Sfx.BUMP to soundPool.load(appContext, R.raw.sfx_bump, 1),
        Sfx.BOOST to soundPool.load(appContext, R.raw.sfx_boost, 1),
        Sfx.HOME to soundPool.load(appContext, R.raw.sfx_home, 1),
        Sfx.WIN to soundPool.load(appContext, R.raw.sfx_win, 1),
    )

    private var music: MediaPlayer? = null

    init {
        soundPool.setOnLoadCompleteListener { _, sampleId, status ->
            if (status == 0) loadedIds.add(sampleId)
        }
    }

    private enum class Sfx { SELECT, CARD, MOVE, BUMP, BOOST, HOME, WIN }

    private fun play(sfx: Sfx) {
        if (settings.muted) return
        val id = soundIds[sfx] ?: return
        if (id !in loadedIds) return
        val vol = (settings.volumePercent / 100f).coerceIn(0f, 1f)
        soundPool.play(id, vol, vol, 1, 0, 1f)
    }

    fun menuSelect() = play(Sfx.SELECT)
    fun cardDraw() = play(Sfx.CARD)
    fun moveTick() = play(Sfx.MOVE)
    fun bump() = play(Sfx.BUMP)
    fun boost() = play(Sfx.BOOST)
    fun pawnHome() = play(Sfx.HOME)
    fun winFanfare() = play(Sfx.WIN)

    /** Starts the looping background music bed. Safe to call once, up front. */
    fun startMusic() {
        if (music != null) return
        music = MediaPlayer.create(appContext, R.raw.music_loop)?.apply {
            isLooping = true
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            applyMusicVolume(this)
            start()
        }
    }

    /** Call after any Settings mutation (mute/volume) so playing music updates live. */
    fun applySettings() {
        music?.let { applyMusicVolume(it) }
    }

    private fun applyMusicVolume(player: MediaPlayer) {
        val vol = if (settings.muted) 0f else (settings.volumePercent / 100f).coerceIn(0f, 1f) * 0.5f
        player.setVolume(vol, vol)
    }

    fun release() {
        music?.release()
        music = null
        soundPool.release()
    }
}
