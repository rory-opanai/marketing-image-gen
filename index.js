const express = require('express');
const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${port}`;
const IMAGE_CONCURRENCY = Math.max(1, Number(process.env.IMAGE_CONCURRENCY || 10));
const REQUEST_API_KEY = "37af22c9821443618e0737b752a7ea6a";

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Writable paths: on Vercel, the deployment bundle is read-only; only /tmp is writable.
const IS_VERCEL = !!process.env.VERCEL || !!process.env.NOW_REGION;
const WRITE_BASE_DIR = IS_VERCEL ? '/tmp' : ROOT_DIR;
const READONLY_IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
// Where we will write new images:
const IMAGES_DIR = IS_VERCEL ? path.join(WRITE_BASE_DIR, 'images') : READONLY_IMAGES_DIR;
// Where we will write/read campaigns data:
const CAMPAIGNS_FILE = IS_VERCEL ? path.join(WRITE_BASE_DIR, 'campaign.json') : path.join(ROOT_DIR, 'campaign.json');

// Simple logger
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// Ensure folders exist at startup (no-op if on read-only FS like Vercel)
async function ensureDirs() {
  try {
    if (!fssync.existsSync(PUBLIC_DIR)) {
      log('Creating PUBLIC_DIR:', PUBLIC_DIR);
      fssync.mkdirSync(PUBLIC_DIR, { recursive: true });
    }
    if (!fssync.existsSync(IMAGES_DIR)) {
      log('Creating IMAGES_DIR:', IMAGES_DIR);
      fssync.mkdirSync(IMAGES_DIR, { recursive: true });
    }
  } catch (e) {
    // Likely running in a read-only environment (e.g., Vercel Serverless)
    log('Skipping ensureDirs due to error (read-only environment?):', e && e.message ? e.message : e);
  }
}

// Basic middleware
app.use(express.json({ limit: '4mb' }));

// Serve writable images dir first (e.g., /tmp/images on Vercel), then fallback to bundled public/images
if (IMAGES_DIR !== READONLY_IMAGES_DIR) {
  app.use('/images', express.static(IMAGES_DIR));
}
app.use('/images', express.static(READONLY_IMAGES_DIR));

// Serve other static assets (index.html, etc.) from the bundled public directory
app.use(express.static(PUBLIC_DIR));

// Log all requests
app.use((req, res, next) => {
  log(`[${req.method}] ${req.originalUrl}`);
  next();
});

app.get('/', async (req, res) => {
  // Serve index.html if present; otherwise give a simple pointer
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fssync.existsSync(indexPath)) {
    log('Serving index.html');
    res.sendFile(indexPath);
  } else {
    log('index.html not found, sending fallback message');
    res.send('Marketing Campaign server running. Add public/index.html to view gallery.');
  }
});

// Country-specific guidelines
const countryGuidelines = [
    { UK: "Black pumps for Diesel (MG & SVP), Green pumps for Petrol (MG & SVP). Right-hand drive, UK plates. Local stations only, no foreign anomalies. No CSC fueling on forecourt, in-store interactions only. Diverse models (Black male ~35, White female ~35, mixed-race family with two children, older White couple ~55, high-visibility worker). Seasonal UK imagery, families browsing snacks/drinks, Costa coffee, EV charging with coffee breaks." },
    { DE: "Green (Mogas/petrol 10% Bio), Yellow (Mogas/Petrol), Red (V-Power Mogas/Petrol), Grey (V-Power Diesel), Black/Yellow (Diesel). Left-hand drive, German plates, German cars preferred. German landscapes, cities, petrol stations, signage. German coffee/snacks, Shell ClubSmart in smartphone screens. Staff without caps or bakery caps. European people only. Shell Café imagery, HSSE compliance, long-term image rights." },
    { AT: "Green Mogas/Petrol, Red V-Power Mogas/Petrol. Left-hand drive, Austrian/German plates. Austrian/German landscapes, Shell Car Wash imagery, Billa Unterwegs shops, German script/currency. Staff without caps or bakery caps. European people only. Shell Café imagery, HSSE standards, long-term image rights." },
    { NL: "Green Mogas/Petrol, Red V-Power Mogas/Petrol (maingrade green nozzle resonates better overall). Left-hand drive, Dutch plates. Shell Café instead of Costa Coffee. No plastic sandwich packaging. Staff without caps or bakery caps. European people only. No images with only coins (Air Miles used), no ‘O’ animation in Shell GO+." },
    { BE: "Green Mogas/Petrol, Red V-Power Mogas/Petrol. Left-hand drive, Belgian plates. Same as DE/AT/NL guidelines. European people only." },
    { FR: "N/A for fuel and vehicle-specific rules." },
    { PL: "Premium: Red sticker/red nozzle (SVP Racing, SVP 95); Diesel: black nozzle; Fuelsave 95: green nozzle. Left-hand drive, Polish plates. Polish cities/sites, Shell Café, focus on fuel, minimal EV chargers. Shell ClubSmart branding, gift displays, family consumption imagery. Shell staff in shop/forecourt. European people only, Christmas/Easter holidays. Visuals for drinks, snacks, sandwiches, cashier phone app." },
    { LX: "Green Mogas/Petrol, Red V-Power Mogas/Petrol. Same vehicle/location rules as PL." },
    { TR: "Grey diesel pumps, green petrol pumps. Left-hand drive, Turkish plates, local car models. Turkish landscapes, Shell Select shops, full CVP visuals. Turkish people only, Bayram celebrations, fasting month, no Christmas. HSSE-focused imagery, typical customers 40+ families." },
    { CZ: "SFS Diesel (black), SFS 95 (green), SVP 95 (red), SVP Racing (red nozzle). Left-hand drive, EU plates blurred. Local station images, Shell Café, ClubSmart branding, minimal EV chargers. Western/European people (not too Scandinavian). Major holidays (Christmas, Easter, New Year). CSC interactions in shop/forecourt." },
    { SK: "Same as CZ." },
    { HU: "Same as CZ." },
    { BG: "Same as CZ, includes Shell AutoGas LPG." },
    { TH: "Separate pumps: V-Power (VPG & VPD), Maingrade (Mogas & Diesel). Light-duty vehicles, motorcycles, brands like Honda, Toyota, BMW, Porsche. Separate V-Power vs normal stations." },
    { PH: "Not specified for fuel pumps. Asian-looking customers." }
  ];
  
//   // Persona guidelines
//   const personaGuidelines = [
//     { "Disciplined Nutritionist": "Strict healthy regimen, plans well in advance, values control." },
//     { "Wholesome Enthusiast": "Outgoing, sociable, creative, enjoys experimenting with recipes and fresh ingredients." },
//     { "Gourmet Explorer": "Values experience and quality, enjoys exploring and learning." },
//     { "Spontaneous Snacker": "Gives in to cravings, makes impulsive decisions, stays within budget." },
//     { "Quick Fixer": "Always on the move, values convenience, food as fuel, willing to pay extra." },
//     { "Wallet Watcher": "Seeks lowest price, prioritizes deals, uninterested in food quality." },
//     { "Savvy Traditionalists": "Budget-focused families, prefer tried and tested solutions, dislike new tech." },
//     { "Conscious Pragmatists": "Environmentally conscious, values durability, participates in circular economy." },
//     { "Cautious Planners": "Meticulous, frugal, risk-averse, prefers known brands." },
//     { "Considerate Pioneers": "Eco-conscious, influenced by social perception, family/community oriented." },
//     { "Spontaneous Indulgers": "Fun-loving, trend-conscious, values convenience and aesthetics." },
//     { "Independent Enthusiasts": "Passionate about hobbies, values self-reliance, seeks quality experiences." },
//     { "Quality Believer": "Values high-quality fuel for vehicle performance and protection, prefers trusted brands." },
//     { "Reward Seeker": "Loyal to brands offering rewards, values convenience in payment." },
//     { "Access Focused": "Seeks convenience and speed, minimal interest in fuel brand." },
//     { "Unengaged": "Views fuel as a necessity, shops around for best price." },
//     { "Penny Pincher": "Focuses on lowest prices, often pays cash to control spending." },
//     { "Road Warrior": "High fuel spender, visits stations frequently, shops on-site, price-insensitive." }
//   ];
  
  // Product descriptions (fuels)
  const productDescriptions = [
    { "V-Power": "Premium fuel offering enhanced performance and engine protection." },
    { "Recharge": "Shell's electric vehicle charging service, associated with Light Blue branding." },
    { "Fuelsave": "Standard grade fuel with improved efficiency claims." },
    { "Shell Café": "Shell's in-station café offering coffee, snacks, and fresh food." },
    { "deli2go": "Shell's quick-service food and beverage retail offering." }
  ];
  
  // Helpers to retrieve guideline text for country and product
  function getCountryGuideline(country) {
    const name = typeof country === 'string' ? country : (country?.code || country?.name || '');
    if (!name) return '';
    for (const obj of countryGuidelines) {
      const [k, v] = Object.entries(obj)[0] || [];
      if (k && String(k).toLowerCase() === String(name).toLowerCase()) return v;
    }
    return '';
  }

  function getProductDescription(product) {
    if (product && typeof product === 'object' && product.description) return product.description;
    const name = typeof product === 'string' ? product : (product?.name || '');
    if (!name) return '';
    for (const obj of productDescriptions) {
      const [k, v] = Object.entries(obj)[0] || [];
      if (k && String(name).toLowerCase().includes(String(k).toLowerCase())) return v;
    }
    return '';
  }

  function buildGuidelineAppend(country, product) {
    const parts = [];
    const countryText = getCountryGuideline(country);
    const productText = getProductDescription(product);
    const countryLabel = typeof country === 'string' ? country : (country?.code || country?.name || '');
    const productLabel = typeof product === 'string' ? product : (product?.name || '');
    if (countryText) parts.push(`Country (${countryLabel}): ${countryText}`);
    if (productText) parts.push(`Product (${productLabel}): ${productText}`);
    if (!parts.length) return '';
    return `Follow these constraints and context:\n- ${parts.join('\n- ')}`;
  }


// In-memory task registry for async processing
const tasks = new Map(); // id -> { id, status, created_at, updated_at, status_url, app_url, result?, error? }

// Simple in-memory write queue to avoid concurrent writes clobbering campaign.json
let campaignsWriteQueue = Promise.resolve();
function appendCampaignSafe(campaign) {
  campaignsWriteQueue = campaignsWriteQueue.then(async () => {
    let all = { data: [] };
    try {
      if (fssync.existsSync(CAMPAIGNS_FILE)) {
        const raw = await fs.readFile(CAMPAIGNS_FILE, 'utf-8');
        if (raw && raw.trim()) {
          all = JSON.parse(raw);
          if (!all || typeof all !== 'object' || !Array.isArray(all.data)) {
            all = { data: [] };
          }
        }
      }
    } catch (e) {
      log('campaign.json unreadable. Recreating.', e);
      all = { data: [] };
    }
    all.data.push(campaign);
    await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(all, null, 2));
    log('Campaign persisted safely:', campaign.id);
  }).catch(err => {
    console.error('appendCampaignSafe error:', err);
  });
  return campaignsWriteQueue;
}

// Helper to update an existing campaign entry by id, safely serialized through the same queue
function updateCampaignByIdSafe(id, updater) {
  campaignsWriteQueue = campaignsWriteQueue.then(async () => {
    let all = { data: [] };
    try {
      if (fssync.existsSync(CAMPAIGNS_FILE)) {
        const raw = await fs.readFile(CAMPAIGNS_FILE, 'utf-8');
        if (raw && raw.trim()) {
          all = JSON.parse(raw);
          if (!all || typeof all !== 'object' || !Array.isArray(all.data)) {
            all = { data: [] };
          }
        }
      }
    } catch (e) {
      log('campaign.json unreadable during update. Recreating.', e);
      all = { data: [] };
    }
    const idx = all.data.findIndex(c => c && c.id === id);
    if (idx === -1) {
      log('Campaign not found for update, creating new with id:', id);
      all.data.push({ id });
    }
    const targetIndex = idx === -1 ? all.data.length - 1 : idx;
    const ref = all.data[targetIndex];
    try {
      updater(ref);
    } catch (e) {
      console.error('Error applying campaign updater for id:', id, e);
    }
    await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(all, null, 2));
    log('Campaign updated safely:', id);
  }).catch(err => {
    console.error('updateCampaignByIdSafe error:', err);
  });
  return campaignsWriteQueue;
}

// Convenience: update a single asset slot for a campaign by index
function updateCampaignAssetSafe(id, assetIndex, assetData) {
  return updateCampaignByIdSafe(id, (c) => {
    if (!Array.isArray(c.assets)) {
      c.assets = [];
    }
    c.assets[assetIndex] = assetData;
    c.updated_at = new Date().toISOString();
  });
}

// Helper: normalize and create a campaign from request body, persist to campaign.json
async function createCampaignFromBody(body, onProgress) {
  // Flexible body fields; only assets are required for image gen
  const {
    offer_summary,
    mechanic,
    timing_window,
    targeting,
    creative_direction,
    cta,
    legal,
    email_template,
    asset_list,
    assets: assetsRaw,
    design_notes,
    production_notes,
    country,
    product,
  } = body || {};

  // Pre-generate a campaign id to allow incremental persistence
  const campaignId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Normalize assets into an array of { name, prompt, alt_text?, links?, design_notes? }
  let assets = [];
  if (Array.isArray(asset_list)) {
    // Accept either array of strings or objects
    assets = asset_list.map((item, idx) => {
      if (typeof item === 'string') return { name: `asset_${idx + 1}`, prompt: item };
      const name = item.name || item.title || `asset_${idx + 1}`;
      const prompt = item.prompt || item.description || '';
      return { name, prompt, alt_text: item.alt_text, links: item.links, design_notes: item.design_notes };
    });
  } else if (assetsRaw && typeof assetsRaw === 'object') {
    // Object map: { "Hero": "prompt...", "Secondary": "..." }
    assets = Object.entries(assetsRaw).map(([name, val]) => {
      if (typeof val === 'string') return { name, prompt: val };
      return { name, prompt: val.prompt || val.description || '', alt_text: val.alt_text, links: val.links, design_notes: val.design_notes };
    });
  } else if (body && typeof body === 'object') {
    // Heuristic: treat all top-level string fields that look like assets
    const candidateKeys = Object.keys(body).filter(k => /hero|secondary|mosaic|image/i.test(k));
    assets = candidateKeys.map(k => ({ name: k, prompt: String(body[k]) }));
  }

  if (!assets.length) {
    const err = new Error('No assets provided. Provide asset_list or assets.');
    err.status = 400;
    throw err;
  }

  // Ensure directories
  await ensureDirs();

  // Persist a base campaign record immediately so assets can be filled incrementally
  const baseCampaign = {
    id: campaignId,
    created_at: new Date().toISOString(),
    offer_summary,
    mechanic,
    timing_window,
    targeting,
    creative_direction,
    cta,
    legal,
    email_template,
    design_notes,
    production_notes,
    country,
    product,
    assets: assets.map((a) => ({
      name: a.name || '',
      prompt: (a.prompt || '').trim(),
      alt_text: a.alt_text,
      links: a.links,
      design_notes: a.design_notes,
    })),
  };
  await appendCampaignSafe(baseCampaign);

  // Generate images for each asset with limited concurrency
  const generated = new Array(assets.length);
  let completed = 0;

  const worker = async (asset, index) => {
    const prompt = String(asset.prompt || '').trim();
    if (!prompt) {
      const res = { ...asset, error: 'Missing prompt' };
      generated[index] = res;
      completed++;
      onProgress && onProgress({ completed, total: assets.length });
      return res;
    }
    try {
      const guidelineAppend = buildGuidelineAppend(country, product);
      const finalPrompt = guidelineAppend ? `${prompt}\n\n${guidelineAppend}` : prompt;
      const img = await callOpenAIImage(finalPrompt, { country, product });
      const res = { ...asset, image: img, url: img.url };
      generated[index] = res;
      // Persist this asset into the campaign immediately
      await updateCampaignAssetSafe(campaignId, index, res);
      completed++;
      onProgress && onProgress({ completed, total: assets.length });
      return res;
    } catch (err) {
      const res = { ...asset, error: 'generation_failed', error_detail: String((err && err.message) || err) };
      generated[index] = res;
      await updateCampaignAssetSafe(campaignId, index, res);
      completed++;
      onProgress && onProgress({ completed, total: assets.length });
      return res;
    }
  };

  // Concurrency runner
  const runWithConcurrency = async (items, limit, fn) => {
    const pending = [];
    let i = 0;
    const launchNext = () => {
      if (i >= items.length) return Promise.resolve();
      const idx = i++;
      const p = Promise.resolve(fn(items[idx], idx)).then(() => {
        // remove from pending when done
        pending.splice(pending.indexOf(p), 1);
      });
      pending.push(p);
      let chain = Promise.resolve();
      if (pending.length >= limit) {
        chain = Promise.race(pending);
      }
      return chain.then(launchNext);
    };
    const starters = new Array(Math.min(limit, items.length)).fill(0).map(launchNext);
    await Promise.all(starters);
  };

  await runWithConcurrency(assets, IMAGE_CONCURRENCY, worker);

  // Finalize: update the campaign with the fully generated assets
  const campaign = {
    ...baseCampaign,
    assets: generated,
  };
  await updateCampaignByIdSafe(campaignId, (c) => {
    Object.assign(c, campaign);
    c.updated_at = new Date().toISOString();
  });

  return campaign;
}

// Expose campaigns JSON for the gallery to load
app.get('/campaigns.json', async (req, res) => {
  try {
    const exists = fssync.existsSync(CAMPAIGNS_FILE);
    if (!exists) {
      log('campaign.json not found, returning empty data');
      return res.json({ data: [] });
    }
    const raw = await fs.readFile(CAMPAIGNS_FILE, 'utf-8');
    const json = JSON.parse(raw || '{"data":[]}');
    log('Served campaigns.json');
    res.json(json);
  } catch (err) {
    console.error('Failed to read campaigns.json:', err);
    res.status(500).json({ error: 'Failed to read campaigns' });
  }
});

// Create campaign asynchronously: enqueue and return a task
app.post('/create-campaign', async (req, res) => {
    log('POST /create-campaign - checking auth');
  // add a x-api-key check to the request
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== REQUEST_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  log('POST /create-campaign - queued async task');
  try {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const statusUrl = `${APP_URL}/tasks/${id}`;
    const task = {
      id,
      status: 'queued',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status_url: statusUrl,
      app_url: APP_URL,
    };
    tasks.set(id, task);

    // Process in background
    setImmediate(async () => {
      try {
        task.status = 'processing';
        task.progress = { completed: 0, total: 0 };
        task.updated_at = new Date().toISOString();
        const campaign = await createCampaignFromBody(req.body, (p) => {
          task.progress = p;
          task.updated_at = new Date().toISOString();
        });
        task.status = 'done';
        task.result = { campaign };
        task.updated_at = new Date().toISOString();
      } catch (err) {
        console.error('Async campaign task failed:', err);
        task.status = 'error';
        task.error = { message: String((err && err.message) || err) };
        task.updated_at = new Date().toISOString();
      }
    });

    res.status(202).json({
      task_id: id,
      status: 'accepted',
      status_url: statusUrl,
      app_url: APP_URL,
      message: 'Campaign creation queued',
    });
  } catch (err) {
    console.error('Failed to enqueue campaign', err);
    res.status(500).json({ error: 'Failed to enqueue campaign', app_url: APP_URL });
  }
});

// Task status endpoint
app.get('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const task = tasks.get(id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found', app_url: APP_URL });
  }
  // Always include app_url; include result or error depending on state
  const { status, status_url, result, error, created_at, updated_at, progress } = task;
  res.json({ id, status, status_url, app_url: APP_URL, created_at, updated_at, progress, result: status === 'done' ? result : undefined, error: status === 'error' ? error : undefined });
});

// Image generation via OpenAI Images API
async function callOpenAIImage(prompt, { country, product } = {}) {
  if (!OPENAI_API_KEY) {
    // No API key: create a simple SVG placeholder so the gallery still works
    log('No OPENAI_API_KEY set, generating SVG placeholder for prompt:', prompt);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffd500"/>
      <stop offset="100%" stop-color="#ff1a00"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <foreignObject x="40" y="40" width="944" height="944">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111; background: rgba(255,255,255,0.85); padding: 24px; border-radius: 16px; font-size: 36px; line-height: 1.3;">
      <div style="font-weight:700; margin-bottom:12px;">Placeholder Image</div>
      <div>${escapeHtml((prompt || '').slice(0, 260))}</div>
    </div>
  </foreignObject>
</svg>`;
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-placeholder.svg`;
    const filePath = path.join(IMAGES_DIR, filename);
    await fs.writeFile(filePath, svg, 'utf8');
    log('SVG placeholder written to', filePath);
    return {
      country: typeof country === 'string' ? country : (country?.name || ''),
      product: typeof product === 'string' ? product : (product?.name || ''),
      prompt,
      filename,
      path: filePath,
      url: `/images/${filename}`,
      placeholder: true,
    };
  }

  log('Calling OpenAI Images API for prompt:', prompt);
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt,
      n: 1,
      size: process.env.OPENAI_IMAGE_SIZE || '1024x1024',
    }),
  });

  if (!response.ok) {
    let bodyText;
    try {
      bodyText = await response.text();
    } catch (e) {
      bodyText = '<no response body>';
    }
    log('OpenAI Images API error:', response.status, response.statusText, bodyText);
    const err = new Error(`OpenAI Images API error: ${response.status} ${response.statusText} - ${bodyText}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const first = data?.data?.[0] || {};
  let buffer;
  if (typeof first.b64_json === 'string' && first.b64_json.length > 0) {
    log('Received b64_json image from OpenAI');
    buffer = Buffer.from(first.b64_json, 'base64');
  } else if (typeof first.url === 'string' && first.url.startsWith('http')) {
    log('Received image URL from OpenAI:', first.url);
    const imgRes = await fetch(first.url);
    if (!imgRes.ok) {
      log('Failed to fetch image url:', imgRes.status, imgRes.statusText);
      const err = new Error(`Failed to fetch image url: HTTP ${imgRes.status} ${imgRes.statusText}`);
      err.status = imgRes.status;
      throw err;
    }
    const arr = await imgRes.arrayBuffer();
    buffer = Buffer.from(arr);
  } else {
    log('OpenAI Images API returned no image data');
    throw new Error('OpenAI Images API returned no image data (neither b64_json nor url)');
  }

  const slug = (s) => String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const countryName = typeof country === 'string' ? country : (country?.name || '');
  const productName = typeof product === 'string' ? product : (product?.name || '');

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slug(countryName)}-${slug(productName)}.png`;
  const filePath = path.join(IMAGES_DIR, filename);
  await fs.writeFile(filePath, buffer);
  log('Image written to', filePath);

  return {
    country: countryName,
    countryDescription: typeof country === 'object' ? (country?.description || '') : '',
    product: productName,
    productDescription: typeof product === 'object' ? (product?.description || '') : '',
    prompt,
    filename,
    path: filePath,
    url: `/images/${filename}`,
  };
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Export the app for serverless environments (e.g., Vercel)
module.exports = app;

// Start server locally only when executed directly
if (require.main === module) {
  ensureDirs().then(() => {
    app.listen(port, () => {
      log(`Server is running on http://localhost:${port}`);
    });
  });
}