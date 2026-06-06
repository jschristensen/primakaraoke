// Cloudflare Worker — Prima Karaoke link resolver
// -------------------------------------------------------------------------
// Resolves "artist + title" -> exact Apple Music / Spotify / Tidal links and
// the track duration. It runs the iTunes Search API and Odesli/Songlink
// SERVER-SIDE, where browser CORS/JSONP limits don't apply, and returns JSON
// with permissive CORS so the static GitHub Pages app can call it.
//
// No API keys or credentials required.
//
// Deploy (about 5 minutes, free):
//   Option A — dashboard:
//     1. https://dash.cloudflare.com  ->  Workers & Pages  ->  Create  ->  Worker
//     2. Replace the starter code with this file, click Deploy.
//     3. Copy the URL, e.g. https://prima-resolver.<your-subdomain>.workers.dev
//   Option B — CLI:
//     npm i -g wrangler && wrangler deploy worker/resolver.js --name prima-resolver
//
// Then activate it in the app by visiting (once):
//   https://jschristensen.github.io/primakaraoke/?resolver=https://prima-resolver.<your-subdomain>.workers.dev
// (The URL is saved in your browser; visit with ?resolver=clear to remove it.)

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const artist = (url.searchParams.get("artist") || "").trim();
    const title = (url.searchParams.get("title") || "").trim();
    const out = { apple: null, spotify: null, tidal: null, durationSec: null };
    if (!title) return new Response(JSON.stringify(out), { headers: cors });

    const itunes = async (term) => {
      const r = await fetch(
        "https://itunes.apple.com/search?media=music&entity=song&limit=1&term=" + encodeURIComponent(term),
        { headers: { "Accept": "application/json" } }
      );
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.results && j.results[0] ? j.results[0] : null;
    };

    try {
      let hit = await itunes((artist + " " + title).trim());
      if (!hit) hit = await itunes(title); // retry on title alone
      if (hit) {
        out.apple = hit.trackViewUrl || null;
        if (hit.trackTimeMillis) out.durationSec = Math.round(hit.trackTimeMillis / 1000);
        if (out.apple) {
          const od = await fetch(
            "https://api.song.link/v1-alpha.1/links?platform=appleMusic&userCountry=US&songIfSingle=true&url=" +
              encodeURIComponent(out.apple),
            { headers: { "Accept": "application/json" } }
          );
          if (od.ok) {
            const L = ((await od.json()) || {}).linksByPlatform || {};
            if (L.appleMusic && L.appleMusic.url) out.apple = L.appleMusic.url;
            if (L.spotify && L.spotify.url) out.spotify = L.spotify.url;
            if (L.tidal && L.tidal.url) out.tidal = L.tidal.url;
          }
        }
      }
    } catch (_) { /* return whatever we have */ }

    return new Response(JSON.stringify(out), { headers: cors });
  },
};
