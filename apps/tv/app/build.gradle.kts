import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing is configured via environment variables / a local
// keystore.properties file that is NEVER committed (see .gitignore).
// See docs/deployment.md for how to provide these for a signed release build.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.bumprun.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.bumprun.tv"
        minSdk = 23
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug {
            // Deliberately empty: a plausible-looking fake default (e.g. a
            // hardcoded LAN IP) silently matches or mismatches whatever
            // network you're actually on, which is confusing to debug. Empty
            // means Settings shows it as an unmistakable example/placeholder
            // instead of looking like a real saved value. Set per-machine via
            // the in-app Settings screen, matching what `pnpm run dev:lan`
            // prints.
            buildConfigField("String", "DEFAULT_SERVER_URL", "\"\"")
            buildConfigField("boolean", "DEBUG_MENU_ENABLED", "true")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Production deployments MUST set this to the real public server URL at build time
            // (e.g. via -PprodServerUrl=... or editing this default before a real release build).
            buildConfigField(
                "String",
                "DEFAULT_SERVER_URL",
                "\"${project.findProperty("prodServerUrl") ?: ""}\"",
            )
            buildConfigField("boolean", "DEBUG_MENU_ENABLED", "false")

            if (keystorePropertiesFile.exists()) {
                signingConfig = signingConfigs.create("release") {
                    storeFile = file(keystoreProperties["storeFile"] as String)
                    storePassword = keystoreProperties["storePassword"] as String
                    keyAlias = keystoreProperties["keyAlias"] as String
                    keyPassword = keystoreProperties["keyPassword"] as String
                }
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    packaging {
        resources.excludes.add("/META-INF/{AL2.0,LGPL2.1}")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.tv:tv-foundation:1.0.0-alpha10")

    // Socket.IO client -- talks the same realtime protocol as the Node server.
    implementation("io.socket:socket.io-client:2.1.1") {
        exclude(group = "org.json", module = "json")
    }

    // QR code generation -- pure-Java, no Google Play Services dependency.
    implementation("com.google.zxing:core:3.5.3")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
