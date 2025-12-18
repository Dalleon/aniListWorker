const ANILIST = "https://graphql.anilist.co";
const PER_PAGE = 50;

const QUERY = `query($page:Int,$perPage:Int){
  Page(page:$page,perPage:$perPage){
    pageInfo { hasNextPage }
    media(type: ANIME){
      id
      genres
      description
      bannerImage
      title { english romaji native }
      recommendations {
        edges {
          node {
            rating
            mediaRecommendation { id genres description bannerImage title { english romaji native } }
          }
        }
      }
    }
  }
}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(page, perPage = PER_PAGE) {
    let attempt = 0;
    while (true) {
        attempt++;
        try {
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

function getTitle(m) {
    return m.title?.english || m.title?.romanji || m.title?.native || ""
}

function processMediaList(mediaList, nodes, edgesMap) {
    for (const m of mediaList) {
        nodes.set(m.id, {
            id: m.id,
            genre: m.genres,
            desc: m.description,
            img: m.bannerImage,
            title: getTitle(m)
        });

        const recs = m.recommendations?.edges || [];
        for (const e of recs) {
            const to = e.node?.mediaRecommendation?.id;
            if (!to) continue;

            const mediaRecom = e.node.mediaRecommendation;
            nodes.set(to, {
                id: to,
                genre: mediaRecom.genres,
                desc: mediaRecom.description,
                img: mediaRecom.bannerImage,
                title: getTitle(mediaRecom)
            });

            // read recommendation rating (weight) from the recommendation node
            const rating = Number(e.node.rating) || 0;

            const key = [m.id, to].map(String).sort().join(',');
            //const prev = edgesMap.get(key) || 0;
            edgesMap.set(key, rating);
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

function combinedSizeBytes(nodesMap, edgesMap) {
  const nodesJson = JSON.stringify(Array.from(nodesMap.entries()));
  // edgesMap is Map<"from,to", weight>
  const edgesJson = JSON.stringify(Array.from(edgesMap.entries()));
  return bytesOfString(nodesJson) + bytesOfString(edgesJson);
}

function bytesToMB(bytes) {
  return bytes / (1024 * 1024);
}
//

async function crawlAll({ perPage = PER_PAGE } = {}) {
    const nodes = new Map();
    const edges = new Map(); // Map<"from,to", number-weight>
    let page = 1;

    while (true) {
        try {
            const pageData = await fetchPage(page, perPage);
            const media = pageData.media || [];
            if (!media.length) break;

            processMediaList(media, nodes, edges);

            const combinedBytes = combinedSizeBytes(nodes, edges);
            const combinedMB = bytesToMB(combinedBytes);

            // compute total weight sum for logging
            const totalWeight = Array.from(edges.values()).reduce((a, b) => a + b, 0);

            console.log(`page ${page} -> nodes=${nodes.size} edges=${edges.size} totalWeight=${totalWeight.toFixed(0)} combined=${combinedMB.toFixed(2)} MB`);

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

async function runInit() {
    const { nodes, edges } = await crawlAll();
    return { nodes, edges }
}

module.exports = {
    runInit
}
