package io.powerscratchedx.backend;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public record AppConfig(
        int port,
        Path pnxJar,
        Path staticDir,
        Path workDir,
        int maxConcurrentBuilds,
        int maxSourceBytes,
        int buildsPerMinutePerIp,
        String allowedOrigin
) {

    public static AppConfig fromEnvAndArgs(String[] args) {
        int port = intOf(env("PORT"), 8080);
        String pnxJar = env("PNX_JAR");
        String staticDir = env("STATIC_DIR");
        String workDir = env("WORK_DIR");
        int maxConcurrent = intOf(env("MAX_CONCURRENT_BUILDS"), 2);
        int maxSource = intOf(env("MAX_SOURCE_BYTES"), 512 * 1024);
        int perMinute = intOf(env("BUILDS_PER_MINUTE"), 10);
        String origin = env("ALLOWED_ORIGIN");

        for (int i = 0; i < args.length - 1; i++) {
            switch (args[i]) {
                case "--port" -> port = Integer.parseInt(args[++i]);
                case "--pnx-jar" -> pnxJar = args[++i];
                case "--static" -> staticDir = args[++i];
                case "--work" -> workDir = args[++i];
                default -> { }
            }
        }

        Path jar = Paths.get(pnxJar != null ? pnxJar : "lib/powernukkitx.jar").toAbsolutePath();
        Path stat = staticDir != null ? Paths.get(staticDir).toAbsolutePath() : defaultStaticDir();
        Path work = Paths.get(workDir != null ? workDir : "work").toAbsolutePath();
        return new AppConfig(port, jar, stat, work, maxConcurrent, maxSource, perMinute, origin != null ? origin : "*");
    }

    private static Path defaultStaticDir() {
        Path candidate = Paths.get("../website/dist").toAbsolutePath().normalize();
        return Files.isDirectory(candidate) ? candidate : null;
    }

    private static String env(String key) {
        String v = System.getenv(key);
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static int intOf(String value, int fallback) {
        try {
            return value == null ? fallback : Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
