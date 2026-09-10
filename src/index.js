import { handleAiHub } from './ai-hub.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ai-hub') {
      return handleAiHub(request, env);
    }
    // Everything else (index.html, sw.js, manifest.webmanifest, ...) is
    // served straight from the assets binding — same static files as before.
    return env.ASSETS.fetch(request);
  }
};
