package com.bumprun.tv

import android.app.Application
import org.conscrypt.Conscrypt
import java.security.Security

/**
 * Installs Conscrypt as the top TLS provider before anything in the app
 * touches the network. See the dependency comment in app/build.gradle.kts
 * -- this exists because some Fire TV Sticks run old enough Android that
 * their system trust store doesn't validate the realtime server's current
 * Let's Encrypt certificate chain, which otherwise looks identical to a
 * generic "can't reach server" failure with no useful error surfaced.
 */
class BumpRunApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        runCatching {
            Security.insertProviderAt(Conscrypt.newProvider(), 1)
        }
    }
}
