const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('./auth');

const router = express.Router();
const designsFilePath = path.join(__dirname, '../data/designs.json');
const uploadsDir = path.join(__dirname, '../uploads');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;

    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadEnvFile(path.join(__dirname, '../.env'));
loadEnvFile(path.join(__dirname, '../../.env'));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 90000);
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_IMAGE_MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
const CLOUDFLARE_PROMPT_MODEL = process.env.CLOUDFLARE_PROMPT_MODEL || '@cf/meta/llama-3.1-8b-instruct';
const ENABLE_AI_PROMPT_ENHANCER = process.env.ENABLE_AI_PROMPT_ENHANCER === 'true';
const CLOUDFLARE_TIMEOUT_MS = Number(process.env.CLOUDFLARE_TIMEOUT_MS || 90000);

// ---------------------------------------------------------------------------
// Multer configuration for image uploads
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `design-${Date.now()}-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif, webp, svg) are allowed.'));
  },
});

fs.mkdirSync(uploadsDir, { recursive: true });

// ---------------------------------------------------------------------------
// SVG Design Templates – one per style
// ---------------------------------------------------------------------------

function buildSvg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${body}</svg>`;
}

const SVG_TEMPLATES = {
  minimalist: buildSvg(`
    <defs>
      <linearGradient id="gm" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f8f9fa"/>
        <stop offset="100%" style="stop-color:#e9ecef"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#gm)"/>
    <circle cx="100" cy="85" r="35" fill="none" stroke="#212529" stroke-width="2"/>
    <line x1="100" y1="50" x2="100" y2="120" stroke="#212529" stroke-width="1.5"/>
    <line x1="65" y1="85" x2="135" y2="85" stroke="#212529" stroke-width="1.5"/>
    <text x="100" y="150" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="#495057" font-weight="600">MINIMALIST</text>
    <text x="100" y="166" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="8" fill="#868e96">Less is more</text>
  `),

  streetwear: buildSvg(`
    <defs>
      <linearGradient id="gs" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e"/>
        <stop offset="100%" style="stop-color:#16213e"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#gs)"/>
    <polygon points="100,20 130,70 170,80 140,115 148,165 100,142 52,165 60,115 30,80 70,70" fill="none" stroke="#e94560" stroke-width="2.5"/>
    <polygon points="100,40 120,72 150,78 128,105 134,145 100,128 66,145 72,105 50,78 80,72" fill="#e94560" opacity="0.3"/>
    <text x="100" y="182" text-anchor="middle" font-family="Impact,sans-serif" font-size="14" fill="#e94560" letter-spacing="3">STREET</text>
    <text x="100" y="196" text-anchor="middle" font-family="Impact,sans-serif" font-size="9" fill="#0f3460" letter-spacing="2">CULTURE</text>
  `),

  vintage: buildSvg(`
    <defs>
      <radialGradient id="gv" cx="50%" cy="50%" r="60%">
        <stop offset="0%" style="stop-color:#fefae0"/>
        <stop offset="100%" style="stop-color:#dda15e"/>
      </radialGradient>
    </defs>
    <rect width="200" height="200" fill="url(#gv)"/>
    <circle cx="100" cy="90" r="50" fill="none" stroke="#606c38" stroke-width="2"/>
    <circle cx="100" cy="90" r="42" fill="none" stroke="#606c38" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="100" y="86" text-anchor="middle" font-family="Georgia,serif" font-size="13" fill="#283618" font-weight="700">VINTAGE</text>
    <text x="100" y="100" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="#606c38">— Est. 2024 —</text>
    <line x1="58" y1="110" x2="142" y2="110" stroke="#bc6c25" stroke-width="1"/>
    <text x="100" y="160" text-anchor="middle" font-family="Georgia,serif" font-size="9" fill="#283618">PREMIUM QUALITY</text>
    <rect x="60" y="148" width="80" height="18" rx="2" fill="none" stroke="#283618" stroke-width="1"/>
  `),

  abstract: buildSvg(`
    <defs>
      <linearGradient id="ga" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#667eea"/>
        <stop offset="50%" style="stop-color:#764ba2"/>
        <stop offset="100%" style="stop-color:#f093fb"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="#0f0c29"/>
    <circle cx="60" cy="70" r="40" fill="#667eea" opacity="0.6"/>
    <circle cx="140" cy="60" r="30" fill="#764ba2" opacity="0.5"/>
    <circle cx="100" cy="130" r="45" fill="#f093fb" opacity="0.4"/>
    <circle cx="50" cy="150" r="20" fill="#a29bfe" opacity="0.5"/>
    <circle cx="160" cy="140" r="25" fill="#fd79a8" opacity="0.4"/>
    <rect x="80" y="40" width="40" height="40" rx="8" fill="url(#ga)" opacity="0.7" transform="rotate(30 100 60)"/>
    <text x="100" y="185" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="#ffffff" font-weight="600" letter-spacing="2">ABSTRACT</text>
  `),

  anime: buildSvg(`
    <defs>
      <linearGradient id="gan" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#ff6b6b"/>
        <stop offset="100%" style="stop-color:#feca57"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="#2d3436"/>
    <polygon points="100,15 115,55 160,55 125,80 138,120 100,95 62,120 75,80 40,55 85,55" fill="url(#gan)"/>
    <circle cx="100" cy="140" r="8" fill="#ff6b6b"/>
    <circle cx="80" cy="155" r="5" fill="#feca57" opacity="0.7"/>
    <circle cx="120" cy="155" r="5" fill="#feca57" opacity="0.7"/>
    <line x1="60" y1="140" x2="40" y2="130" stroke="#ff6b6b" stroke-width="2"/>
    <line x1="140" y1="140" x2="160" y2="130" stroke="#ff6b6b" stroke-width="2"/>
    <line x1="60" y1="148" x2="35" y2="145" stroke="#feca57" stroke-width="1.5"/>
    <line x1="140" y1="148" x2="165" y2="145" stroke="#feca57" stroke-width="1.5"/>
    <text x="100" y="188" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#feca57" font-weight="700" letter-spacing="1">ANIME</text>
  `),

  ai3d: buildSvg(`
    <defs>
      <radialGradient id="g3d" cx="35%" cy="25%" r="70%">
        <stop offset="0%" style="stop-color:#ffffff"/>
        <stop offset="45%" style="stop-color:#ff9f43"/>
        <stop offset="100%" style="stop-color:#d35400"/>
      </radialGradient>
      <filter id="s3d">
        <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <rect width="200" height="200" fill="#f8fafc"/>
    <circle cx="100" cy="92" r="54" fill="url(#g3d)" filter="url(#s3d)"/>
    <circle cx="82" cy="78" r="9" fill="#0f172a"/>
    <circle cx="118" cy="78" r="9" fill="#0f172a"/>
    <ellipse cx="100" cy="105" rx="27" ry="18" fill="#fff7ed"/>
    <path d="M84 112 Q100 124 116 112" fill="none" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
    <path d="M64 55 L83 29 L92 65 Z" fill="#ffb56b"/>
    <path d="M136 55 L117 29 L108 65 Z" fill="#ffb56b"/>
    <circle cx="76" cy="70" r="11" fill="#ffffff" opacity="0.28"/>
    <text x="100" y="178" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#d35400" font-weight="700">AI 3D</text>
  `),

  watercolor: buildSvg(`
    <defs>
      <radialGradient id="gw1" cx="30%" cy="30%">
        <stop offset="0%" style="stop-color:#74b9ff;stop-opacity:0.8"/>
        <stop offset="100%" style="stop-color:#74b9ff;stop-opacity:0"/>
      </radialGradient>
      <radialGradient id="gw2" cx="70%" cy="50%">
        <stop offset="0%" style="stop-color:#fd79a8;stop-opacity:0.7"/>
        <stop offset="100%" style="stop-color:#fd79a8;stop-opacity:0"/>
      </radialGradient>
      <radialGradient id="gw3" cx="50%" cy="70%">
        <stop offset="0%" style="stop-color:#55efc4;stop-opacity:0.6"/>
        <stop offset="100%" style="stop-color:#55efc4;stop-opacity:0"/>
      </radialGradient>
    </defs>
    <rect width="200" height="200" fill="#fefefe"/>
    <ellipse cx="60" cy="60" rx="65" ry="55" fill="url(#gw1)"/>
    <ellipse cx="145" cy="90" rx="55" ry="60" fill="url(#gw2)"/>
    <ellipse cx="90" cy="145" rx="70" ry="50" fill="url(#gw3)"/>
    <ellipse cx="40" cy="140" rx="35" ry="30" fill="#a29bfe" opacity="0.3"/>
    <ellipse cx="160" cy="160" rx="30" ry="25" fill="#fdcb6e" opacity="0.35"/>
    <text x="100" y="108" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="#2d3436" font-style="italic">watercolor</text>
    <text x="100" y="122" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="#636e72">dreamy · soft · artistic</text>
  `),

  geometric: buildSvg(`
    <defs>
      <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#00b894"/>
        <stop offset="100%" style="stop-color:#00cec9"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="#0c0c1d"/>
    <polygon points="100,20 40,65 40,135 100,180 160,135 160,65" fill="none" stroke="#00b894" stroke-width="2"/>
    <polygon points="100,40 60,72 60,128 100,160 140,128 140,72" fill="none" stroke="#00cec9" stroke-width="1.5"/>
    <polygon points="100,60 80,78 80,122 100,140 120,122 120,78" fill="url(#gg)" opacity="0.3"/>
    <line x1="100" y1="20" x2="100" y2="180" stroke="#6c5ce7" stroke-width="0.5" opacity="0.5"/>
    <line x1="40" y1="100" x2="160" y2="100" stroke="#6c5ce7" stroke-width="0.5" opacity="0.5"/>
    <circle cx="100" cy="100" r="4" fill="#fd79a8"/>
    <text x="100" y="195" text-anchor="middle" font-family="Courier New,monospace" font-size="10" fill="#00cec9" letter-spacing="3">GEOMETRIC</text>
  `),

  typography: buildSvg(`
    <defs>
      <linearGradient id="gt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#6c5ce7"/>
        <stop offset="100%" style="stop-color:#a29bfe"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="#2d3436"/>
    <text x="100" y="50" text-anchor="middle" font-family="Impact,sans-serif" font-size="28" fill="url(#gt)" letter-spacing="2">TYPE</text>
    <text x="100" y="82" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="#dfe6e9" font-style="italic">is an art form</text>
    <line x1="40" y1="92" x2="160" y2="92" stroke="#6c5ce7" stroke-width="1"/>
    <text x="100" y="115" text-anchor="middle" font-family="Courier New,monospace" font-size="9" fill="#74b9ff" letter-spacing="4">ABCDEFG</text>
    <text x="100" y="132" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#a29bfe">Aa Bb Cc Dd Ee</text>
    <text x="100" y="155" text-anchor="middle" font-family="Impact,sans-serif" font-size="20" fill="#fd79a8" letter-spacing="6">FONT</text>
    <text x="100" y="175" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="#636e72">The quick brown fox jumps</text>
    <rect x="30" y="25" width="140" height="165" rx="4" fill="none" stroke="#6c5ce7" stroke-width="1" opacity="0.4"/>
  `),
};

// Default fallback SVG for unknown styles
const DEFAULT_STYLE = 'abstract';

/**
 * Encode an SVG string as a data URI
 */
function svgToDataUri(svg) {
  // Using charset=utf-8 encoding for cleaner URLs
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Get the SVG template for a given style
 */
function getDesignSvg(style) {
  const key = (style || DEFAULT_STYLE).toLowerCase();
  const svg = SVG_TEMPLATES[key] || SVG_TEMPLATES[DEFAULT_STYLE];
  return svgToDataUri(svg);
}

// Build a special "from-image" SVG (used for generate-from-image endpoint)
function getFromImageSvg() {
  const svg = buildSvg(`
    <defs>
      <linearGradient id="gfi" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#e17055"/>
        <stop offset="33%" style="stop-color:#d63031"/>
        <stop offset="66%" style="stop-color:#6c5ce7"/>
        <stop offset="100%" style="stop-color:#0984e3"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="#1e272e"/>
    <rect x="30" y="30" width="60" height="60" rx="6" fill="#e17055" opacity="0.7" transform="rotate(15 60 60)"/>
    <circle cx="140" cy="60" r="30" fill="#6c5ce7" opacity="0.6"/>
    <polygon points="100,110 70,170 130,170" fill="#0984e3" opacity="0.5"/>
    <circle cx="60" cy="150" r="22" fill="#d63031" opacity="0.5"/>
    <rect x="120" y="130" width="45" height="45" rx="4" fill="#fdcb6e" opacity="0.4" transform="rotate(-10 142 152)"/>
    <text x="100" y="195" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="10" fill="#dfe6e9" letter-spacing="1">IMAGE REMIX</text>
  `);
  return svgToDataUri(svg);
}

// Helper function to read designs
function readDesigns() {
  try {
    if (!fs.existsSync(designsFilePath)) {
      return [];
    }
    const data = fs.readFileSync(designsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading designs:', err);
    return [];
  }
}

function hasOpenAIConfig() {
  return Boolean(OPENAI_API_KEY && typeof fetch === 'function');
}

function hasCloudflareConfig() {
  return Boolean(CLOUDFLARE_API_TOKEN && CLOUDFLARE_ACCOUNT_ID && typeof fetch === 'function');
}

const STYLE_PROMPTS = {
  minimalist: 'clean minimalist graphic, precise thin line art, generous negative space, refined and elegant like a modern brand mark, subtle screen-print texture',
  streetwear: 'bold streetwear graphic, high-contrast, urban poster energy, rough ink or spray-stencil texture, hand-drawn marker edge, dynamic diagonal composition',
  vintage: 'vintage badge illustration, retro ink texture, faded screen-print grain, old-school patch and stamp look, dusty warm palette',
  abstract: 'expressive abstract graphic mark, gestural brush strokes, asymmetric organic composition, layered textures, modern art "gallery" energy rather than stock gradients',
  anime: 'anime illustration with confident dynamic ink lines, cel shading, energetic action pose and motion lines, designed like a custom sticker or key visual',
  ai3d: 'playful 3D mascot render, soft studio lighting, rounded forms, glossy clay or vinyl toy material, subtle isometric product-icon feel, one hero character only, no fancy scene',
  watercolor: 'hand-painted watercolor illustration, visible pigment blooms and paper grain, uneven organic edges, sparse and airy rather than fully covered',
  geometric: 'geometric emblem design, angular shapes, precise symmetric composition, clean geometric print, halftone texture, architectural draft atmosphere',
  typography: 'typographic poster graphic, expressive hand-lettering, bold readable type, vintage print or urban sign-painting texture, balanced layout',
};

function normalizeDesignIdea(prompt) {
  return String(prompt || '').trim() || 'original bold graphic emblem';
}

function buildTshirtPrompt({ prompt, style, fromImage = false }) {
  const styleKey = (style || DEFAULT_STYLE).toLowerCase();
  const styleText = STYLE_PROMPTS[styleKey] || STYLE_PROMPTS[DEFAULT_STYLE];
  const idea = normalizeDesignIdea(prompt);
  const sourceInstruction = fromImage
    ? 'Use the uploaded reference only as inspiration for a new standalone print graphic.'
    : 'Create a standalone print graphic from the user idea.';

  return [
    'Standalone sticker/logo artwork only. No apparel mockup.',
    sourceInstruction,
    `Main subject: ${idea}`,
    `Visual style: ${styleText}.`,
    'Design for a real t-shirt artist, not a stock generator: deliberate asymmetric composition, strong readable silhouette, hand-drawn imperfections, visible print texture such as screen-print halftone, risograph grain, ink brush or woodcut.',
    'Add ONE unexpected creative twist related to the subject: an unusual color pairing, a surreal hidden detail, a cultural fusion, or an ironic juxtaposition. Make the artwork feel handmade and distinctive.',
    'Avoid the generic AI look: no soft gradient blobs, no glossy stock render, no lens flare, no perfectly centered symmetrical clipart, no boring flat minimal shapes.',
    'Make the requested subject unmistakable and large in the center or strong off-center of the square canvas.',
    'Keep high readability and print-ready composition with a plain light or transparent-looking background.',
    'Absolutely do not draw a t-shirt, shirt outline, clothing, hanger, model, mannequin, product photo, frame, UI, watermark, or text unless the user explicitly asks for lettering.'
  ].join(' ');
}

function buildProductMockupPrompt() {
  return [
    'Create a realistic blank product mockup image for an ecommerce custom t-shirt preview.',
    'Show one clean short-sleeve t-shirt as the main product, front view, slightly turned in 3/4 perspective, floating on a plain light studio background.',
    'The t-shirt must be completely blank so a separate customer artwork can be composited onto it later.',
    'No print, no graphic, no illustration, no logo, no symbol, no lettering, and no decoration anywhere on the shirt.',
    'Use soft studio lighting, subtle fabric texture, realistic shadows, polished ecommerce product render.',
    'No human model, no hanger, no mannequin, no extra text, no watermark, no UI, no frame.'
  ].join(' ');
}

function extractTextResult(data) {
  return (
    data?.result?.response ||
    data?.result?.text ||
    data?.result?.choices?.[0]?.message?.content ||
    data?.result?.choices?.[0]?.text ||
    data?.response ||
    data?.text ||
    ''
  );
}

function cleanEnhancedPrompt(text) {
  return String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

async function enhanceImagePrompt(prompt, style, fromImage = false) {
  const fallbackPrompt = buildTshirtPrompt({ prompt, style, fromImage });

  if (!ENABLE_AI_PROMPT_ENHANCER || !hasCloudflareConfig()) {
    return fallbackPrompt;
  }

  try {
    const styleKey = (style || DEFAULT_STYLE).toLowerCase();
    const styleText = STYLE_PROMPTS[styleKey] || STYLE_PROMPTS[DEFAULT_STYLE];
    const data = await postCloudflareJson(CLOUDFLARE_PROMPT_MODEL, {
      messages: [
        {
          role: 'system',
          content: [
            'You are a prompt engineer for a t-shirt print artwork generator.',
            'Convert the user request, often in Vietnamese, into one detailed English image prompt.',
            'Return only the final image prompt. No markdown. No explanations.',
            'The image must be standalone print artwork only, never a shirt mockup or product photo.',
            'Preserve every requested subject, place, season, color, number, action, relationship, and visual detail.',
            'Never replace a named place, landmark, person, animal, object, or cultural detail with a different one.',
            'For a named character, meme, brand-like visual reference, or cultural reference, retain the name and explicitly describe its distinctive visual traits so the image model preserves its identity.',
            'Translate faithfully instead of inventing new content. Resolve minor Vietnamese spelling mistakes from context without changing the meaning.',
            'Art direction: think like a real t-shirt artist, not a stock-image generator. Propose ONE specific creative twist that fits the idea (an unconventional color pairing, a surreal or ironic detail, a hidden micro-element, or a Vietnamese cultural fusion) and describe it concretely.',
            'Texture direction: pick a real print technique matching the style (halftone screen-print grain, risograph, rough ink brush, woodcut, sticker-cut edge, watercolor paper) and name it.',
            'Anti-AI-slop instructions to include: avoid soft gradient blobs, glossy stock render, generic lens flare, perfectly centered symmetrical clipart, boring flat minimal shapes; prefer an asymmetric dynamic composition with hand-made feel.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `User request: ${prompt || 'original graphic artwork'}`,
            `Requested style: ${styleText}`,
            fromImage ? 'Reference mode: use the uploaded image only as inspiration.' : '',
            'Requirements: make the requested subject unmistakable; choose placement with purpose (mouthpiece can be off-center); design for a real shirt, not a stock image; moderate negative space.',
            'Fidelity rule: include every meaningful detail from the user request and do not add unrelated landmarks, characters, objects, or text. Do not reduce a named reference to a generic version of the same category.',
            'Negative requirements: no t-shirt, no clothing, no apparel outline, no hanger, no model, no mannequin, no product photo, no UI, no watermark, no frame, no text unless the user asked for lettering.',
          ].filter(Boolean).join('\n'),
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const enhanced = cleanEnhancedPrompt(extractTextResult(data));
    if (enhanced && enhanced.length >= 40) {
      return enhanced;
    }
  } catch (err) {
    console.warn(`[AI-Design] Prompt enhancement failed, using fallback prompt: ${err.message}`);
  }

  return fallbackPrompt;
}

async function postCloudflareJson(model, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLOUDFLARE_TIMEOUT_MS);
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('image/')) {
      if (!response.ok) {
        throw new Error(`Cloudflare request failed with status ${response.status}`);
      }
      return { imageBuffer: Buffer.from(await response.arrayBuffer()) };
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      const message = data.errors?.[0]?.message || data.error || `Cloudflare request failed with status ${response.status}`;
      throw new Error(message);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function postOpenAIJson(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error?.message || `OpenAI request failed with status ${response.status}`;
      throw new Error(message);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function postOpenAIForm(url, formData) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error?.message || `OpenAI request failed with status ${response.status}`;
      throw new Error(message);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function saveGeneratedImage(base64Image, designId) {
  if (!base64Image) {
    throw new Error('AI response did not include image data.');
  }

  const fileName = `${designId}.png`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(base64Image, 'base64'));
  return `/uploads/${fileName}`;
}

function saveGeneratedImageBuffer(buffer, designId) {
  if (!buffer || !buffer.length) {
    throw new Error('AI response did not include image data.');
  }

  const fileName = `${designId}.png`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${fileName}`;
}

function extractBase64Image(data) {
  return (
    data?.data?.[0]?.b64_json ||
    data?.result?.image ||
    data?.result?.images?.[0] ||
    data?.image ||
    data?.images?.[0] ||
    data?.b64_json
  );
}

async function generateCloudflareImage(prompt, style, designId) {
  const finalPrompt = await enhanceImagePrompt(prompt, style);
  const data = await postCloudflareJson(CLOUDFLARE_IMAGE_MODEL, {
    prompt: finalPrompt,
  });

  let designUrl;
  if (data.imageBuffer) {
    designUrl = saveGeneratedImageBuffer(data.imageBuffer, designId);
  } else {
    designUrl = saveGeneratedImage(extractBase64Image(data), designId);
  }

  return { designUrl, finalPrompt };
}

async function generateCloudflareProductMockup(prompt, style, designId) {
  const finalProductPrompt = buildProductMockupPrompt({ prompt, style });
  const data = await postCloudflareJson(CLOUDFLARE_IMAGE_MODEL, {
    prompt: finalProductPrompt,
  });

  let productMockupUrl;
  if (data.imageBuffer) {
    productMockupUrl = saveGeneratedImageBuffer(data.imageBuffer, `${designId}-product`);
  } else {
    productMockupUrl = saveGeneratedImage(extractBase64Image(data), `${designId}-product`);
  }

  return { productMockupUrl, finalProductPrompt };
}

async function generateOpenAIImage(prompt, style, designId) {
  const finalPrompt = await enhanceImagePrompt(prompt, style);
  const data = await postOpenAIJson('https://api.openai.com/v1/images/generations', {
    model: OPENAI_IMAGE_MODEL,
    prompt: finalPrompt,
    size: OPENAI_IMAGE_SIZE,
  });

  return { designUrl: saveGeneratedImage(extractBase64Image(data), designId), finalPrompt };
}

async function generateOpenAIProductMockup(prompt, style, designId) {
  const finalProductPrompt = buildProductMockupPrompt({ prompt, style });
  const data = await postOpenAIJson('https://api.openai.com/v1/images/generations', {
    model: OPENAI_IMAGE_MODEL,
    prompt: finalProductPrompt,
    size: OPENAI_IMAGE_SIZE,
  });

  return {
    productMockupUrl: saveGeneratedImage(extractBase64Image(data), `${designId}-product`),
    finalProductPrompt,
  };
}

async function editOpenAIImage(file, idea, designId) {
  const prompt = await enhanceImagePrompt(
    idea || 'Turn this image into an original standalone print graphic',
    'reference remix',
    true
  );
  const legacyPrompt = buildTshirtPrompt({
    prompt: idea || 'Turn this image into an original t-shirt graphic',
    style: 'reference remix',
    fromImage: true,
  });
  const buffer = fs.readFileSync(file.path);
  const formData = new FormData();

  formData.append('model', OPENAI_IMAGE_MODEL);
  formData.append('prompt', prompt || legacyPrompt);
  formData.append('size', OPENAI_IMAGE_SIZE);
  formData.append('image[]', new Blob([buffer], { type: file.mimetype }), file.originalname);

  const data = await postOpenAIForm('https://api.openai.com/v1/images/edits', formData);
  return { designUrl: saveGeneratedImage(extractBase64Image(data), designId), finalPrompt: prompt || legacyPrompt };
}

function saveDesignRecord({ designId, prompt, style, author, designUrl, productMockupUrl, productMockupBlank, sourceImage, finalPrompt, finalProductPrompt }) {
  const designs = readDesigns();
  designs.push({
    id: designId,
    prompt,
    promptEn: prompt,
    style: style || DEFAULT_STYLE,
    author: author || 'Guest',
    likes: 0,
    createdAt: new Date().toISOString().split('T')[0],
    designUrl,
    productMockupUrl,
    productMockupBlank: Boolean(productMockupBlank),
    sourceImage,
    finalPrompt,
    finalProductPrompt,
    aiProvider: designUrl?.startsWith('/uploads/') ? 'ai' : 'mock',
  });
  writeDesigns(designs);
}

// Helper function to write designs
function writeDesigns(data) {
  try {
    fs.writeFileSync(designsFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing designs:', err);
    return false;
  }
}

const commentsFilePath = path.join(__dirname, '../data/comments.json');

function readComments() {
  try {
    if (!fs.existsSync(commentsFilePath)) return [];
    return JSON.parse(fs.readFileSync(commentsFilePath, 'utf8'));
  } catch (err) {
    console.error('Error reading comments:', err);
    return [];
  }
}

function writeComments(data) {
  try {
    fs.writeFileSync(commentsFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing comments:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST /api/ai-design/generate
// Mock AI design generation from text prompt
// ---------------------------------------------------------------------------
router.post('/generate', async (req, res) => {
  try {
    const { prompt, style, author, enhanceOnly } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'A prompt is required.' });
    }

    if (enhanceOnly) {
      try {
        const enhancedPrompt = await enhanceImagePrompt(prompt, style, false);
        return res.json({ success: true, enhancedPrompt });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    const designId = 'design-' + Date.now();
    const authorName = author || 'Guest';
    let designUrl;
    let productMockupUrl;
    let finalPrompt;
    let finalProductPrompt;
    let provider = 'mock';

    if (hasCloudflareConfig()) {
      try {
        const result = await generateCloudflareImage(prompt, style, designId);
        designUrl = result.designUrl;
        finalPrompt = result.finalPrompt;
        try {
          const productResult = await generateCloudflareProductMockup(prompt, style, designId);
          productMockupUrl = productResult.productMockupUrl;
          finalProductPrompt = productResult.finalProductPrompt;
        } catch (mockupErr) {
          console.warn(`[AI-Design] Cloudflare 3D product mockup failed, continuing with print design: ${mockupErr.message}`);
        }
        provider = 'cloudflare';
      } catch (err) {
        console.warn(`[AI-Design] Cloudflare generation failed, trying next provider: ${err.message}`);
      }
    }

    if (!designUrl && hasOpenAIConfig()) {
      try {
        const result = await generateOpenAIImage(prompt, style, designId);
        designUrl = result.designUrl;
        finalPrompt = result.finalPrompt;
        try {
          const productResult = await generateOpenAIProductMockup(prompt, style, designId);
          productMockupUrl = productResult.productMockupUrl;
          finalProductPrompt = productResult.finalProductPrompt;
        } catch (mockupErr) {
          console.warn(`[AI-Design] OpenAI 3D product mockup failed, continuing with print design: ${mockupErr.message}`);
        }
        provider = 'openai';
      } catch (err) {
        console.warn(`[AI-Design] OpenAI generation failed, using fallback: ${err.message}`);
      }
    }

    if (!designUrl) {
      designUrl = getDesignSvg(style);
    }

    console.log(`[AI-Design] Generated design ${designId} via ${provider} for prompt: "${prompt}" (style: ${style || DEFAULT_STYLE})`);
    saveDesignRecord({
      designId,
      prompt,
      style: style || DEFAULT_STYLE,
      author: authorName,
      designUrl,
      productMockupUrl,
      productMockupBlank: Boolean(productMockupUrl),
      finalPrompt,
      finalProductPrompt,
    });

    res.json({
      success: true,
      designId,
      designUrl,
      productMockupUrl,
      productMockupBlank: Boolean(productMockupUrl),
      prompt,
      style: style || DEFAULT_STYLE,
      author: authorName,
      provider,
      finalPrompt,
      finalProductPrompt,
    });
  } catch (err) {
    console.error('[AI-Design] Error generating design:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate design' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-design/generate-from-image
// Mock AI design generation from an uploaded image
// ---------------------------------------------------------------------------
router.post('/generate-from-image', upload.single('image'), async (req, res) => {
  try {
    const idea = req.body.idea || '';
    const author = req.body.author || 'Guest';
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'An image file is required.' });
    }

    const designId = 'design-' + Date.now();
    let designUrl;
    let finalPrompt;
    let provider = 'mock';

    if (hasCloudflareConfig()) {
      try {
        const result = await generateCloudflareImage(idea || 'Remix this reference image into an original t-shirt graphic', 'reference remix', designId);
        designUrl = result.designUrl;
        finalPrompt = result.finalPrompt;
        provider = 'cloudflare';
      } catch (err) {
        console.warn(`[AI-Design] Cloudflare image generation failed, trying next provider: ${err.message}`);
      }
    }

    if (!designUrl && hasOpenAIConfig() && typeof FormData !== 'undefined' && typeof Blob !== 'undefined') {
      try {
        const result = await editOpenAIImage(file, idea, designId);
        designUrl = result.designUrl;
        finalPrompt = result.finalPrompt;
        provider = 'openai';
      } catch (err) {
        console.warn(`[AI-Design] OpenAI image edit failed, using fallback: ${err.message}`);
      }
    }

    if (!designUrl) {
      designUrl = getFromImageSvg();
    }

    console.log(`[AI-Design] Generated design ${designId} via ${provider} from image: "${file.filename}" idea: "${idea}"`);
    saveDesignRecord({
      designId,
      prompt: idea || 'Remix from image',
      style: 'abstract',
      author,
      designUrl,
      sourceImage: `/uploads/${file.filename}`,
      finalPrompt,
    });

    res.json({
      success: true,
      designId,
      designUrl,
      uploadedFile: file.filename,
      idea,
      author,
      provider,
      finalPrompt,
    });
  } catch (err) {
    console.error('[AI-Design] Error generating from image:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate design from image' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-design/:id/share  — Share design to community gallery
// ---------------------------------------------------------------------------
router.post('/:id/share', (req, res) => {
  try {
    const designId = decodeURIComponent(req.params.id);
    const { designUrl, frontDesignUrl, backDesignUrl, prompt, style, author, userId, authorUsername } = req.body;

    if (!designUrl) {
      return res.status(400).json({ success: false, error: 'designUrl is required' });
    }

    const designs = readDesigns();
    const existing = designs.find(d => d.designId === designId);

    if (existing) {
      existing.isShared = true;
      existing.sharedAt = new Date().toISOString();
      if (userId && !existing.userId) existing.userId = userId;
      if (authorUsername && !existing.authorUsername) existing.authorUsername = authorUsername;
      writeDesigns(designs);
    } else {
      designs.push({
        designId,
        prompt: prompt || '',
        style: style || 'abstract',
        author: author || 'Community',
        userId: userId || null,
        authorUsername: authorUsername || null,
        designUrl,
        frontDesignUrl: frontDesignUrl || designUrl,
        backDesignUrl: backDesignUrl || '',
        isShared: true,
        sharedAt: new Date().toISOString(),
        likes: 0,
      });
      writeDesigns(designs);
    }

    console.log(`[AI-Design] Design ${designId} shared to gallery`);
    res.json({ success: true, message: 'Design shared successfully' });
  } catch (err) {
    console.error('[AI-Design] Error sharing design:', err.message);
    res.status(500).json({ success: false, error: 'Failed to share design' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-design/:id/like  — Toggle like on a design
// ---------------------------------------------------------------------------
router.post('/:id/like', (req, res) => {
  try {
    const designId = decodeURIComponent(req.params.id);
    const userId = req.body.userId || 'anonymous';

    const designs = readDesigns();
    const design = designs.find(d => d.designId === designId);
    if (!design) return res.status(404).json({ success: false, error: 'Design not found' });

    if (!design.likedBy) design.likedBy = [];
    if (typeof design.likes !== 'number') design.likes = design.likedBy.length;

    const idx = design.likedBy.indexOf(userId);
    if (idx === -1) {
      design.likedBy.push(userId);
      design.likes = design.likedBy.length;
      writeDesigns(designs);
      return res.json({ success: true, liked: true, likes: design.likes });
    }

    design.likedBy.splice(idx, 1);
    design.likes = design.likedBy.length;
    writeDesigns(designs);
    res.json({ success: true, liked: false, likes: design.likes });
  } catch (err) {
    console.error('[AI-Design] Error toggling like:', err.message);
    res.status(500).json({ success: false, error: 'Failed to toggle like' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ai-design/:id/comments — Danh sách comment của thiết kế
// POST /api/ai-design/:id/comments — Thêm comment (cần JWT)
// ---------------------------------------------------------------------------
router.get('/:id/comments', (req, res) => {
  try {
    const designId = decodeURIComponent(req.params.id);
    const comments = readComments()
      .filter(c => c.designId === designId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json({ success: true, data: comments });
  } catch (err) {
    console.error('[AI-Design] List comments error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to list comments' });
  }
});

router.post('/:id/comments', authenticate, (req, res) => {
  try {
    const designId = decodeURIComponent(req.params.id);
    const { text } = req.body;

    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, error: 'Nội dung bình luận không được để trống.' });
    }

    const author = (req.user && req.user.id) ? {
      userId: req.user.id,
      authorName: req.user.fullName || req.user.username || 'Khách',
      authorUsername: req.user.username,
      authorAvatar: req.user.avatar || '',
    } : null;

    if (!author) {
      return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập để bình luận.' });
    }

    const designs = readDesigns();
    if (!designs.some(d => d.designId === designId)) {
      return res.status(404).json({ success: false, error: 'Thiết kế không tồn tại.' });
    }

    const comment = {
      id: 'c-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      designId,
      ...author,
      text: String(text).trim().slice(0, 500),
      createdAt: new Date().toISOString(),
    };

    const comments = readComments();
    comments.push(comment);
    writeComments(comments);

    console.log(`[AI-Design] Comment added on ${designId} by ${comment.authorName}`);
    res.status(201).json({ success: true, message: 'Đã thêm bình luận.', data: comment });
  } catch (err) {
    console.error('[AI-Design] Add comment error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ai-design/gallery
// Return sample designs with their SVG thumbnails
// ---------------------------------------------------------------------------
router.get('/gallery', (_req, res) => {
  try {
    const designs = readDesigns();
    const comments = readComments();
    const commentCountByDesign = comments.reduce((acc, c) => {
      acc[c.designId] = (acc[c.designId] || 0) + 1;
      return acc;
    }, {});
    const galleryWithImages = designs.map((d) => ({
      ...d,
      designUrl: d.designUrl || (d.sourceImage ? getFromImageSvg() : getDesignSvg(d.style)),
      productMockupUrl: d.productMockupUrl || null,
      commentCount: commentCountByDesign[d.designId] || 0,
    }));
    // Sort: newest first
    const sortedGallery = [...galleryWithImages].reverse();
    res.json({ success: true, count: sortedGallery.length, data: sortedGallery });
  } catch (err) {
    console.error('[AI-Design] Error fetching gallery:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch gallery' });
  }
});

module.exports = router;
