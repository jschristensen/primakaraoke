// Build links.json — resolve each song in the songbook to exact Apple / Spotify
// / Tidal links + duration, server-side in CI (no CORS limits here). The static
// page then reads links.json directly (same origin), so no browser lookups or
// per-user backend are needed.
//
// Run by .github/workflows/build-links.yml; can also be run locally with Node 20+.

import { readFile, writeFile } from "node:fs/promises";

const SRC = { owner:"pederbacher", repo:"songs", branch:"main", dir:"songs",
              collection:"collection-primabacher_2026.txt" };
const raw = (f)=> `https://raw.githubusercontent.com/${SRC.owner}/${SRC.repo}/${SRC.branch}/${SRC.dir}/${encodeURIComponent(f)}`;
const OUT = "links.json";
const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

// must match the app's parsing so keys line up exactly
function titleArtistFromFile(file){
  const base = file.replace(/\.txt$/i,"");
  const parts = base.split("___");
  const artist = (parts[0]||"").replace(/_/g," ").trim();
  const title  = (parts.slice(1).join(" ")||parts[0]).replace(/_/g," ").replace(/\.(simple|advanced)$/,"").trim();
  return { artist, title };
}
const keyFor = (artist, title)=> `${artist} — ${title}`;

async function getJSON(url, tries=3){
  for(let i=0;i<tries;i++){
    try{
      const r = await fetch(url, { headers:{ Accept:"application/json", "User-Agent":"PrimaKaraoke-linkbuilder/1.0" } });
      if(r.status===429){ await sleep(8000*(i+1)); continue; }
      if(!r.ok) return null;
      return await r.json();
    }catch{ await sleep(1500*(i+1)); }
  }
  return null;
}

async function itunes(term){
  const j = await getJSON(`https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${encodeURIComponent(term)}`);
  return j && j.results && j.results[0] ? j.results[0] : null;
}

async function resolve(artist, title){
  const out = { apple:null, spotify:null, tidal:null, durationSec:null };
  let hit = await itunes(`${artist} ${title}`.trim());
  if(!hit) hit = await itunes(title.trim());
  if(!hit) return out;
  out.apple = hit.trackViewUrl || null;
  if(hit.trackTimeMillis) out.durationSec = Math.round(hit.trackTimeMillis/1000);
  if(out.apple){
    const od = await getJSON(`https://api.song.link/v1-alpha.1/links?platform=appleMusic&userCountry=US&songIfSingle=true&url=${encodeURIComponent(out.apple)}`);
    const L = od && od.linksByPlatform;
    if(L){
      if(L.appleMusic && L.appleMusic.url) out.apple   = L.appleMusic.url;
      if(L.spotify   && L.spotify.url)     out.spotify = L.spotify.url;
      if(L.tidal     && L.tidal.url)       out.tidal   = L.tidal.url;
    }
  }
  return out;
}

async function main(){
  const collRes = await fetch(raw(SRC.collection));
  if(!collRes.ok) throw new Error("collection fetch failed: " + collRes.status);
  const files = [];
  const seen = new Set();
  (await collRes.text()).split("\n").map(s=>s.trim()).forEach(f=>{ if(f && !seen.has(f)){ seen.add(f); files.push(f); } });

  // keep previously-resolved entries so a partial run never loses good data
  let prev = {};
  try{ prev = JSON.parse(await readFile(OUT, "utf8")); }catch{}

  const result = { ...prev };
  let ok = 0;
  for(const f of files){
    const { artist, title } = titleArtistFromFile(f);
    const key = keyFor(artist, title);
    const r = await resolve(artist, title);
    if(r.apple || r.spotify || r.tidal){ result[key] = r; ok++; console.log(`ok   ${key}  ${r.spotify?"S":"-"}${r.tidal?"T":"-"}${r.apple?"A":"-"} ${r.durationSec||""}`); }
    else console.log(`miss ${key}`);
    await sleep(7000); // be gentle with Odesli's unauthenticated rate limit
  }

  await writeFile(OUT, JSON.stringify(result, null, 0) + "\n");
  console.log(`\nResolved ${ok}/${files.length} songs -> ${OUT} (${Object.keys(result).length} total entries)`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
