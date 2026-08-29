plugins {
    application
}

group = "io.powerscratchedx"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.google.code.gson:gson:2.11.0")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

application {
    mainClass.set("io.powerscratchedx.backend.Main")
}

tasks.jar {
    manifest {
        attributes("Main-Class" to "io.powerscratchedx.backend.Main")
    }
    from({
        configurations.runtimeClasspath.get().filter { it.name.endsWith("jar") }.map { zipTree(it) }
    })
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    archiveFileName.set("powerscratchedx-backend.jar")
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
}
