package io.powerscratchedx.backend;

import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.jar.Attributes;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;
import java.util.jar.Manifest;
import java.util.regex.Pattern;
import java.util.stream.Stream;

public final class BuildService {

    public record Artifact(String fileName, byte[] bytes, boolean cached) { }

    private static final Pattern NAME = Pattern.compile("^[A-Za-z0-9_.-]{1,40}$");
    private static final Pattern VERSION = Pattern.compile("^[A-Za-z0-9_.+-]{1,20}$");
    private static final Pattern MAIN = Pattern.compile("^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*\\.[A-Z][A-Za-z0-9_]*$");
    private static final Pattern SAFE_PATH = Pattern.compile("^(src/[A-Za-z0-9_/]+\\.java|[A-Za-z0-9_-]+\\.(yml|yaml|json|txt|properties))$");

    private final AppConfig config;
    private final Semaphore slots;
    private final JavaCompiler compiler;
    private final Map<String, Artifact> cache = java.util.Collections.synchronizedMap(new java.util.LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Artifact> eldest) {
            return size() > 50;
        }
    });

    public BuildService(AppConfig config) {
        this.config = config;
        this.slots = new Semaphore(config.maxConcurrentBuilds());
        this.compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            throw new IllegalStateException("No Java compiler available: run the backend with a JDK, not a JRE");
        }
    }

    public boolean isReady() {
        return Files.isRegularFile(config.pnxJar());
    }

    public Artifact build(BuildRequest req) throws BuildException {
        validate(req);
        if (!isReady()) {
            throw new BuildException(503, "PowerNukkitX jar not found at " + config.pnxJar());
        }
        String key = cacheKey(req);
        Artifact cached = cache.get(key);
        if (cached != null) {
            return new Artifact(cached.fileName(), cached.bytes(), true);
        }
        Artifact built = compileAndPackage(req);
        cache.put(key, built);
        return built;
    }

    private static String cacheKey(BuildRequest req) throws BuildException {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            digest.update((req.name + "\n" + req.version + "\n" + req.main + "\n").getBytes(StandardCharsets.UTF_8));
            for (String path : new java.util.TreeSet<>(req.files.keySet())) {
                digest.update(path.getBytes(StandardCharsets.UTF_8));
                digest.update((byte) 0);
                digest.update(req.files.get(path).getBytes(StandardCharsets.UTF_8));
                digest.update((byte) 0);
            }
            return java.util.HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new BuildException(500, "Hashing unavailable");
        }
    }

    private Artifact compileAndPackage(BuildRequest req) throws BuildException {
        if (!slots.tryAcquire()) {
            throw new BuildException(429, "Build server busy, try again in a moment");
        }
        Path dir = null;
        try {
            Files.createDirectories(config.workDir());
            dir = Files.createTempDirectory(config.workDir(), "build-");
            Path src = dir.resolve("src");
            Path classes = dir.resolve("classes");
            Path resources = dir.resolve("resources");
            Files.createDirectories(classes);
            Files.createDirectories(resources);

            List<Path> javaFiles = new ArrayList<>();
            for (Map.Entry<String, String> file : req.files.entrySet()) {
                Path target = (file.getKey().startsWith("src/") ? dir : resources).resolve(file.getKey()).normalize();
                if (!target.startsWith(dir)) {
                    throw new BuildException(400, "Invalid path " + file.getKey());
                }
                Files.createDirectories(target.getParent());
                Files.writeString(target, file.getValue(), StandardCharsets.UTF_8);
                if (file.getKey().endsWith(".java")) {
                    javaFiles.add(target);
                }
            }
            if (javaFiles.isEmpty()) {
                throw new BuildException(400, "No Java sources");
            }

            compile(src, classes, javaFiles);
            byte[] jar = jar(classes, resources);
            return new Artifact(req.name + "-" + req.version + ".jar", jar, false);
        } catch (IOException e) {
            throw new BuildException(500, "I/O error: " + e.getMessage());
        } finally {
            slots.release();
            if (dir != null) {
                deleteQuietly(dir);
            }
        }
    }

    private void validate(BuildRequest req) throws BuildException {
        if (req == null || req.files == null || req.files.isEmpty()) {
            throw new BuildException(400, "Missing files");
        }
        if (req.name == null || !NAME.matcher(req.name).matches()) {
            throw new BuildException(400, "Invalid plugin name");
        }
        if (req.version == null || !VERSION.matcher(req.version).matches()) {
            throw new BuildException(400, "Invalid version");
        }
        if (req.main == null || !MAIN.matcher(req.main).matches()) {
            throw new BuildException(400, "Invalid main class");
        }
        if (!req.files.containsKey("plugin.yml")) {
            throw new BuildException(400, "plugin.yml is required");
        }
        long total = 0;
        for (Map.Entry<String, String> file : req.files.entrySet()) {
            if (file.getKey() == null || !SAFE_PATH.matcher(file.getKey()).matches() || file.getKey().contains("..")) {
                throw new BuildException(400, "Invalid file path: " + file.getKey());
            }
            if (file.getValue() == null) {
                throw new BuildException(400, "Empty file: " + file.getKey());
            }
            total += file.getValue().getBytes(StandardCharsets.UTF_8).length;
        }
        if (total > config.maxSourceBytes()) {
            throw new BuildException(413, "Project too large");
        }
    }

    private void compile(Path src, Path classes, List<Path> javaFiles) throws BuildException, IOException {
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        StringWriter output = new StringWriter();
        try (StandardJavaFileManager fm = compiler.getStandardFileManager(diagnostics, null, StandardCharsets.UTF_8)) {
            List<String> options = List.of(
                    "-d", classes.toString(),
                    "-classpath", config.pnxJar().toString(),
                    "-sourcepath", src.toString(),
                    "--release", "21",
                    "-encoding", "UTF-8",
                    "-proc:none",
                    "-Xlint:none",
                    "-nowarn",
                    "-implicit:none"
            );
            Iterable<? extends JavaFileObject> units = fm.getJavaFileObjectsFromPaths(javaFiles);
            JavaCompiler.CompilationTask task = compiler.getTask(output, fm, diagnostics, options, null, units);
            boolean ok = Boolean.TRUE.equals(task.call());
            if (!ok) {
                List<BuildException.Diagnostic> errors = new ArrayList<>();
                for (Diagnostic<? extends JavaFileObject> d : diagnostics.getDiagnostics()) {
                    if (d.getKind() == Diagnostic.Kind.ERROR) {
                        errors.add(new BuildException.Diagnostic(d.getLineNumber(), d.getMessage(null)));
                    }
                }
                if (errors.isEmpty()) {
                    errors.add(new BuildException.Diagnostic(0, output.toString().isBlank() ? "Unknown compiler error" : output.toString()));
                }
                throw new BuildException(422, "Compilation failed", errors);
            }
        }
    }

    private byte[] jar(Path classes, Path resources) throws IOException {
        Manifest manifest = new Manifest();
        manifest.getMainAttributes().put(Attributes.Name.MANIFEST_VERSION, "1.0");
        manifest.getMainAttributes().putValue("Created-By", "PowerScratchedX");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (JarOutputStream jar = new JarOutputStream(bytes, manifest)) {
            addTree(jar, resources);
            addTree(jar, classes);
        }
        return bytes.toByteArray();
    }

    private static void addTree(JarOutputStream jar, Path root) throws IOException {
        try (Stream<Path> walk = Files.walk(root)) {
            List<Path> files = walk.filter(Files::isRegularFile).sorted().toList();
            for (Path file : files) {
                String entryName = root.relativize(file).toString().replace('\\', '/');
                JarEntry entry = new JarEntry(entryName);
                entry.setTime(0L);
                jar.putNextEntry(entry);
                jar.write(Files.readAllBytes(file));
                jar.closeEntry();
            }
        }
    }

    private static void deleteQuietly(Path dir) {
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // best effort cleanup
                }
            });
        } catch (IOException ignored) {
            // best effort cleanup
        }
    }
}
