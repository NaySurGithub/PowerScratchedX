package io.powerscratchedx.backend;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonSyntaxException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;

public final class HttpApi {

    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();

    private final AppConfig config;
    private final BuildService builds;
    private final BuildStats stats;
    private final Map<String, Deque<Long>> rateLimit = new ConcurrentHashMap<>();
    private HttpServer server;

    public HttpApi(AppConfig config, BuildService builds, BuildStats stats) {
        this.config = config;
        this.builds = builds;
        this.stats = stats;
    }

    public void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress(config.port()), 0);
        server.createContext("/api/health", this::handleHealth);
        server.createContext("/api/build", this::handleBuild);
        server.createContext("/", this::handleStatic);
        server.setExecutor(Executors.newFixedThreadPool(Math.max(4, config.maxConcurrentBuilds() * 2)));
        server.start();
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    private void handleHealth(HttpExchange ex) throws IOException {
        if (preflight(ex)) {
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", builds.isReady());
        body.put("pnxJar", config.pnxJar().getFileName().toString());
        body.put("javaVersion", Runtime.version().toString());
        body.put("builds", stats.count());
        json(ex, 200, body);
    }

    private void handleBuild(HttpExchange ex) throws IOException {
        if (preflight(ex)) {
            return;
        }
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            json(ex, 405, Map.of("ok", false, "error", "Method not allowed"));
            return;
        }
        if (!allowRequest(ex)) {
            json(ex, 429, Map.of("ok", false, "error", "Too many builds, slow down"));
            return;
        }
        BuildRequest req;
        try (InputStream in = ex.getRequestBody()) {
            byte[] raw = in.readNBytes(config.maxSourceBytes() * 2);
            if (in.read() != -1) {
                json(ex, 413, Map.of("ok", false, "error", "Request too large"));
                return;
            }
            req = GSON.fromJson(new String(raw, StandardCharsets.UTF_8), BuildRequest.class);
        } catch (JsonSyntaxException e) {
            json(ex, 400, Map.of("ok", false, "error", "Invalid JSON"));
            return;
        }
        try {
            BuildService.Artifact artifact = builds.build(req);
            ex.getResponseHeaders().set("Content-Type", "application/java-archive");
            ex.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"" + artifact.fileName() + "\"");
            cors(ex);
            ex.sendResponseHeaders(200, artifact.bytes().length);
            try (OutputStream out = ex.getResponseBody()) {
                out.write(artifact.bytes());
            }
            long total = stats.increment();
            Main.LOG.info("Built " + artifact.fileName() + " (" + artifact.bytes().length + " bytes) for " + clientIp(ex) + " - total builds: " + total);
        } catch (BuildException e) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("ok", false);
            body.put("error", e.getMessage());
            body.put("errors", e.diagnostics());
            json(ex, e.status(), body);
        } catch (RuntimeException e) {
            Main.LOG.severe("Build crashed: " + e);
            json(ex, 500, Map.of("ok", false, "error", "Internal error"));
        }
    }

    private void handleStatic(HttpExchange ex) throws IOException {
        Path root = config.staticDir();
        if (root == null) {
            text(ex, 404, "PowerScratchedX backend is running. Static site not configured (STATIC_DIR).");
            return;
        }
        String path = ex.getRequestURI().getPath();
        if (path.equals("/") || path.isEmpty()) {
            path = "/index.html";
        }
        Path file = root.resolve(path.substring(1)).normalize();
        if (!file.startsWith(root) || !Files.isRegularFile(file)) {
            file = root.resolve("index.html");
            if (!Files.isRegularFile(file)) {
                text(ex, 404, "Not found");
                return;
            }
        }
        String type = contentType(file);
        ex.getResponseHeaders().set("Content-Type", type);
        byte[] bytes = Files.readAllBytes(file);
        ex.sendResponseHeaders(200, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    private static String contentType(Path file) {
        String name = file.getFileName().toString();
        if (name.endsWith(".js") || name.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (name.endsWith(".css")) return "text/css; charset=utf-8";
        if (name.endsWith(".html")) return "text/html; charset=utf-8";
        if (name.endsWith(".json")) return "application/json";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".woff2")) return "font/woff2";
        String guessed = URLConnection.guessContentTypeFromName(name);
        return guessed != null ? guessed : "application/octet-stream";
    }

    private boolean allowRequest(HttpExchange ex) {
        String ip = clientIp(ex);
        long now = System.currentTimeMillis();
        Deque<Long> stamps = rateLimit.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (stamps) {
            while (!stamps.isEmpty() && now - stamps.peekFirst() > 60_000) {
                stamps.pollFirst();
            }
            if (stamps.size() >= config.buildsPerMinutePerIp()) {
                return false;
            }
            stamps.addLast(now);
            return true;
        }
    }

    private static String clientIp(HttpExchange ex) {
        String forwarded = ex.getRequestHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return ex.getRemoteAddress().getAddress().getHostAddress();
    }

    private boolean preflight(HttpExchange ex) throws IOException {
        cors(ex);
        if ("OPTIONS".equalsIgnoreCase(ex.getRequestMethod())) {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return true;
        }
        return false;
    }

    private void cors(HttpExchange ex) {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", config.allowedOrigin());
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        ex.getResponseHeaders().set("Access-Control-Expose-Headers", "Content-Disposition");
    }

    private void json(HttpExchange ex, int status, Object body) throws IOException {
        byte[] bytes = GSON.toJson(body).getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        cors(ex);
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    private void text(HttpExchange ex, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }
}
