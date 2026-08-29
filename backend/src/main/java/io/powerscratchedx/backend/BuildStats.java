package io.powerscratchedx.backend;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicLong;

public final class BuildStats {

    private final Path file;
    private final AtomicLong builds = new AtomicLong();

    public BuildStats(Path file) {
        this.file = file;
        load();
    }

    private void load() {
        try {
            if (Files.isRegularFile(file)) {
                builds.set(Long.parseLong(Files.readString(file, StandardCharsets.UTF_8).trim()));
            }
        } catch (IOException | NumberFormatException e) {
            builds.set(0);
        }
    }

    public long count() {
        return builds.get();
    }

    public synchronized long increment() {
        long value = builds.incrementAndGet();
        try {
            Files.createDirectories(file.toAbsolutePath().getParent());
            Files.writeString(file, Long.toString(value), StandardCharsets.UTF_8);
        } catch (IOException e) {
            Main.LOG.warning("Could not save build counter: " + e.getMessage());
        }
        return value;
    }
}
