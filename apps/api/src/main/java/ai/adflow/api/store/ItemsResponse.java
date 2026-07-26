package ai.adflow.api.store;

import java.util.List;

public record ItemsResponse<T>(List<T> items) {}
