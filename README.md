# Marketing Campaign Image Generator

This project exposes an API and gallery for generating marketing campaign imagery.

## Campaign persistence

Campaigns are stored on the local filesystem by default. When running in environments where persistent storage is unavailable, set the `IN_MEMORY_CAMPAIGNS` environment variable to keep campaigns in memory instead. In-memory data is lost whenever the instance experiences a cold start or scales down.
