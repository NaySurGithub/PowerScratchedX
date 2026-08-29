package io.powerscratchedx.backend;

import java.io.IOException;
import java.util.logging.Logger;

public final class Main {

    static final Logger LOG = Logger.getLogger("PowerScratchedX");

    private Main() {
    }

    public static void main(String[] args) throws IOException {
        AppConfig config = AppConfig.fromEnvAndArgs(args);
        BuildService builds = new BuildService(config);
        HttpApi api = new HttpApi(config, builds);

        if (!builds.isReady()) {
            LOG.warning("PowerNukkitX jar not found at " + config.pnxJar() + " - builds will fail until it is provided (PNX_JAR or --pnx-jar)");
        }
        api.start();
        LOG.info("PowerScratchedX backend listening on http://localhost:" + config.port());
        LOG.info("PNX jar: " + config.pnxJar());
        LOG.info("Static site: " + (config.staticDir() != null ? config.staticDir() : "disabled"));
        Runtime.getRuntime().addShutdownHook(new Thread(api::stop));
    }
}
