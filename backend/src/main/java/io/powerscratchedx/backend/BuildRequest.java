package io.powerscratchedx.backend;

import java.util.Map;

public final class BuildRequest {
    public String name;
    public String version;
    public String main;
    public Map<String, String> files;
}
