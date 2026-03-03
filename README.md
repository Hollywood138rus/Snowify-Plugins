# snowify-plugins

Official plugins for [Snowify](https://github.com/nyakuoff/Snowify).

Each subdirectory is a self-contained plugin with its own manifest, renderer script, and optional styles.

## Structure

```
test-plugin/          # Example / test plugin
  snowify-plugin.json
  renderer.js
  styles.css
```

## Creating a new official plugin

1. Create a new folder named after the plugin ID
2. Add a `snowify-plugin.json` manifest, `renderer.js`, and optionally `styles.css`
3. Register the plugin in `plugins/registry.json` in the main [Snowify](https://github.com/nyakuoff/Snowify) repo with `"repo": "nyakuoff/Snowify-Plugins"` and `"path": "your-plugin-id"`

See [PLUGINS.md](https://github.com/nyakuoff/Snowify/blob/main/PLUGINS.md) for the full plugin development guide.
