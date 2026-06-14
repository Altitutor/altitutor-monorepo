# Test deterministic UCAT generation parts

UCAT AI generation tests focus on deterministic validators, content conversion, visual specs, similarity checks, and metadata shaping rather than live model quality. Model calls stay behind a mockable boundary, while real generation quality is assessed through manual evaluation runs, because provider output is variable and should not make CI depend on live AI services.
