plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

import java.util.Properties

android {
    namespace = "com.opentelecrm.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.opentelecrm.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        create("release") {
            val props = releaseSigningProps
            if (props != null) {
                storeFile = file(props.getProperty("storeFile"))
                storePassword = props.getProperty("storePassword")
                keyAlias = props.getProperty("keyAlias")
                keyPassword = props.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (releaseSigningProps != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

/**
 * M5 release signing: reads ../keystore.properties (gitignored). Null when
 * absent so CI/debug builds still configure cleanly (unsigned release).
 */
val releaseSigningProps: Properties?
    get() {
        val f = file("../keystore.properties")
        if (!f.exists()) return null
        return Properties().apply { f.inputStream().use { load(it) } }
    }

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:network"))
    implementation(project(":core:auth"))
    implementation(project(":core:database"))
    implementation(project(":core:sync"))
    implementation(project(":feature:auth"))
    implementation(project(":feature:leads"))
    implementation(project(":feature:dialer"))
    implementation(project(":feature:inbox"))
    implementation(project(":feature:settings"))
    implementation(project(":feature:attendance"))
    implementation(project(":feature:eod"))
    implementation(project(":feature:tasks"))
    implementation(project(":feature:calls"))

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.activity.compose)
    implementation(libs.core.ktx)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.navigation.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.work)
    ksp(libs.hilt.work.compiler)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.core.splashscreen)
    implementation(libs.unifiedpush.connector)
    implementation(libs.profileinstaller)

    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    testImplementation(libs.junit)
}
