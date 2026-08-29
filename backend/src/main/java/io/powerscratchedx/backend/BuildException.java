package io.powerscratchedx.backend;

import java.util.List;

public final class BuildException extends Exception {

    public record Diagnostic(long line, String message) { }

    private final int status;
    private final List<Diagnostic> diagnostics;

    public BuildException(int status, String message, List<Diagnostic> diagnostics) {
        super(message);
        this.status = status;
        this.diagnostics = diagnostics == null ? List.of() : diagnostics;
    }

    public BuildException(int status, String message) {
        this(status, message, List.of());
    }

    public int status() {
        return status;
    }

    public List<Diagnostic> diagnostics() {
        return diagnostics;
    }
}
