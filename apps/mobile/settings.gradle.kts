pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "opentelecrm-mobile"
include(":app")
include(":core:model")
include(":core:network")
include(":core:database")
include(":core:auth")
include(":core:sync")
include(":core:designsystem")
include(":feature:auth")
include(":feature:leads")
include(":feature:dialer")
include(":feature:inbox")
include(":feature:settings")
include(":feature:attendance")
include(":feature:eod")
include(":feature:tasks")
include(":feature:calls")
