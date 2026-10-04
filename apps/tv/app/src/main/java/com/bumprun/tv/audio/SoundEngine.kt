package com.bumprun.tv.audio

import android.media.AudioManager
import android.media.ToneGenerator
import com.bumprun.tv.Settings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * All sounds are simple generated tones (android.media.ToneGenerator) --
 * original, programmatic, and legally clear of any commercial game's audio.
 */
class SoundEngine(private val settings: Settings) {
    private var generator: ToneGenerator? = null
    private val scope = CoroutineScope(Dispatchers.Default)

    private fun gen(): ToneGenerator? {
        if (settings.muted) return null
        if (generator == null) {
            generator = runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, settings.volumePercent) }.getOrNull()
        }
        return generator
    }

    private fun play(tone: Int, durationMs: Int = 90) {
        gen()?.startTone(tone, durationMs)
    }

    fun menuSelect() = play(ToneGenerator.TONE_PROP_BEEP, 60)
    fun cardDraw() = play(ToneGenerator.TONE_PROP_BEEP2, 100)
    fun moveTick() = play(ToneGenerator.TONE_DTMF_1, 40)
    fun bump() = play(ToneGenerator.TONE_PROP_NACK, 160)
    fun boost() = play(ToneGenerator.TONE_SUP_PIP, 150)
    fun pawnHome() = play(ToneGenerator.TONE_PROP_ACK, 140)

    fun winFanfare() {
        scope.launch {
            val notes = listOf(
                ToneGenerator.TONE_DTMF_1,
                ToneGenerator.TONE_DTMF_3,
                ToneGenerator.TONE_DTMF_5,
                ToneGenerator.TONE_DTMF_8,
            )
            for (note in notes) {
                play(note, 140)
                delay(150)
            }
        }
    }

    fun release() {
        generator?.release()
        generator = null
    }
}
