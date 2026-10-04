package com.bumprun.tv

import android.content.Context
import android.content.SharedPreferences

/** Persisted TV settings -- server address, audio, and motion preferences. */
class Settings(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("bumprun_settings", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, BuildConfig.DEFAULT_SERVER_URL) ?: BuildConfig.DEFAULT_SERVER_URL
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value).apply()

    var muted: Boolean
        get() = prefs.getBoolean(KEY_MUTED, false)
        set(value) = prefs.edit().putBoolean(KEY_MUTED, value).apply()

    var volumePercent: Int
        get() = prefs.getInt(KEY_VOLUME, 80)
        set(value) = prefs.edit().putInt(KEY_VOLUME, value.coerceIn(0, 100)).apply()

    var reducedMotion: Boolean
        get() = prefs.getBoolean(KEY_REDUCED_MOTION, false)
        set(value) = prefs.edit().putBoolean(KEY_REDUCED_MOTION, value).apply()

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_MUTED = "muted"
        private const val KEY_VOLUME = "volume"
        private const val KEY_REDUCED_MOTION = "reduced_motion"
    }
}
