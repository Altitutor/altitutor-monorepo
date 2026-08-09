# Separate UCAT category, response type, and answer scheme

UCAT content uses three independent concepts: Question stem category describes the assessed item type, Response type describes the candidate interaction, and Answer scheme defines answer state, validation, persistence, scoring, and review. Runtime behavior is owned by one shared deep response-contract module with a fixed registry of supported schemes; categories provide authoring defaults only, and neither category-name conditionals nor an author-configurable response rules engine may define behavior.
