const ANILIST = "https://graphql.anilist.co";
const PER_PAGE = 50;
const DELAY_MS = 700;

const QUERY = `query($page:Int,$perPage:Int){
  Page(page:$page,perPage:$perPage){
    pageInfo { hasNextPage }
    media {
      id
      title { romaji english }
      recommendations { edges { node { mediaRecommendation { id title { romaji } } } } }
    }
  }
}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(page, perPage = PER_PAGE) {
    let attempt = 0;
    while (true) {
        attempt++;
        try {
            //await sleep(DELAY_MS);
            const res = await fetch(ANILIST, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: QUERY, variables: { page, perPage } }),
            });

            const limit = Number(res.headers.get("x-ratelimit-limit"));
            const remaining = Number(res.headers.get("x-ratelimit-remaining"));
            const retryAfter = Number(res.headers.get("retry-after"));
            const resetAt = Number(res.headers.get("x-ratelimit-reset"));

            if (!res.ok) {
                if (res.status == 429) {
                    let waitMs;

                    if (!isNaN(retryAfter)) {
                        waitMs = retryAfter * 1000;
                    } else if (!isNaN(resetAt)) {
                        waitMs = Math.max(0, resetAt * 1000 - Date.now());
                    } else {
                        waitMs = Math.min(60_000, 2 ** attempt * 1000) +  Math.random() * 500;
                    }

                    console.warn(
                        `429 rate-limited. Waiting ${(waitMs / 1000).toFixed(1)}s (attempt ${attempt})`
                    );
                    await sleep(waitMs);
                    continue;
                } else {
                    throw new Error(`HTTP ${res.status}`);
                }
            }

            if (!isNaN(remaining) && remaining <= 1) {
                let waitMs = 0;

                if (!isNaN(resetAt)) {
                    waitMs = Math.max(0, resetAt * 1000 - Date.now());
                } else {
                    // assume 1min
                    waitMs = 60_000;
                }

                console.warn(
                    `Rate limit nearly exhausted (${remaining}/${limit}). Waiting ${(waitMs / 1000).toFixed(1)}s`
                );
                await sleep(waitMs);
            }

            const data = await res.json();
            if (data.errors) { throw new Error(JSON.stringify(data.errors)); }
            return data.data.Page;
        } catch (err) {
            //if (attempt >= maxRetries) throw err;
            const backoff = 8000 * attempt;
            console.warn(`fetchPage page=${page} failed (attempt ${attempt}): ${err.message}. backoff ${backoff}ms`);
            await sleep(backoff);
        }
    }
}

function processMediaList(mediaList, nodes, edges) {
    //console.log(mediaList)
    for (const m of mediaList) {
        nodes.set(m.id, { id: m.id, title: m.title?.romaji || m.title?.english || "" });
        const recs = m.recommendations?.edges || [];
        for (const e of recs) {
            const to = e.node?.mediaRecommendation?.id;
            if (!to) continue;
            nodes.set(to, { id: to, title: e.node.mediaRecommendation.title?.romaji || "" });
            edges.add(`${m.id},${to}`);
        }
    }
}

//
function bytesOfString(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(str, 'utf8');
  }
  return str.length;
}

function combinedSizeBytes(nodesMap, edgesSet) {
  const nodesJson = JSON.stringify(Array.from(nodesMap.entries()));
  const edgesJson = JSON.stringify(Array.from(edgesSet));
  return bytesOfString(nodesJson) + bytesOfString(edgesJson);
}

function bytesToMB(bytes) {
  return bytes / (1024 * 1024);
}
//

async function crawlAll({ perPage = PER_PAGE } = {}) {
    const nodes = new Map();
    const edges = new Set();
    let page = 1;

    while (true) {
        try {
            const pageData = await fetchPage(page, perPage);
            const media = pageData.media || [];
            if (!media.length) break;

            processMediaList(media, nodes, edges);

            const combinedBytes = combinedSizeBytes(nodes, edges);
            const combinedMB = bytesToMB(combinedBytes);

            console.log(`page ${page} -> nodes=${nodes.size} edges=${edges.size} combined=${combinedMB.toFixed(2)} MB`);

            if (!pageData.pageInfo.hasNextPage) break;
            page++;
            //await sleep(delayMs);
        } catch (err) {
            console.error("Fatal error in crawlAll:", err.message || err);
            break;
        }
    }

    return { nodes, edges };
}

async function start() {
    const { nodes, edges } = await crawlAll();
    return nodes, edges
}

module.exports = {
    start
}
