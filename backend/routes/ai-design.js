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
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'auto';
const OPENAI_IMAGE_BACKGROUND = process.env.OPENAI_IMAGE_BACKGROUND || 'auto';
const OPENAI_IMAGE_OUTPUT_FORMAT = process.env.OPENAI_IMAGE_OUTPUT_FORMAT || 'png';
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 90000);
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_IMAGE_MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
const CLOUDFLARE_PROMPT_MODEL = process.env.CLOUDFLARE_PROMPT_MODEL || '@cf/meta/llama-3.1-8b-instruct';
const ENABLE_AI_PROMPT_ENHANCER = process.env.ENABLE_AI_PROMPT_ENHANCER === 'true';
const ENABLE_AI_PRODUCT_MOCKUP = process.env.ENABLE_AI_PRODUCT_MOCKUP === 'true';
const CLOUDFLARE_TIMEOUT_MS = Number(process.env.CLOUDFLARE_TIMEOUT_MS || 90000);
const AI_PROVIDER_PRIORITY = (process.env.AI_PROVIDER_PRIORITY || 'openai,cloudflare')
  .split(',')
  .map((provider) => provider.trim().toLowerCase())
  .filter(Boolean);

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
  return Boolean(
    CLOUDFLARE_API_TOKEN &&
    CLOUDFLARE_ACCOUNT_ID &&
    !/^your-/i.test(CLOUDFLARE_API_TOKEN) &&
    !/^your-/i.test(CLOUDFLARE_ACCOUNT_ID) &&
    typeof fetch === 'function'
  );
}

function getProviderPriority({ requireImageInput = false } = {}) {
  const providers = AI_PROVIDER_PRIORITY.length ? AI_PROVIDER_PRIORITY : ['openai', 'cloudflare'];
  if (requireImageInput) {
    return ['openai', ...providers.filter((provider) => provider !== 'openai')];
  }
  return providers;
}

const STYLE_PROMPTS = {
  minimalist: 'minimalist vector logo, simple line art, clean negative space',
  streetwear: 'bold streetwear graphic, high contrast, edgy urban poster style',
  vintage: 'vintage badge illustration, retro ink texture, classic screen print look',
  abstract: 'abstract graphic mark, expressive shapes, modern art composition',
  anime: 'anime-inspired illustration, sharp dynamic lines, vibrant character-art energy',
  ai3d: 'AI 3D render style, cute 3D mascot, soft studio lighting, rounded forms, glossy clay or vinyl toy material, isometric product-icon look',
  watercolor: 'soft watercolor illustration, painterly texture, gentle organic edges',
  geometric: 'geometric vector emblem, angular shapes, symmetric composition, clean icon design',
  typography: 'typographic poster graphic, expressive lettering, bold readable type',
};

function normalizeDesignIdea(prompt) {
  return String(prompt || '').trim() || 'original bold graphic emblem';
}

function normalizeCustomText(text) {
  return String(text || '').trim().slice(0, 80);
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase();
}

function cleanSidePrompt(segment, side) {
  const sideWords = side === 'back'
    ? '(?:mat\\s*sau|phia\\s*sau|sau\\s*lung|lung\\s*ao|sau\\s*ao|sau|back)'
    : '(?:mat\\s*truoc|phia\\s*truoc|truoc\\s*ao|truoc|tru c|tr c|front)';

  const cleaned = normalizeSearchText(segment)
    .replace(new RegExp(`\\b(?:in|o|tren|vao|cho|phan)?\\s*${sideWords}\\b`, 'giu'), ' ')
    .replace(/\b(?:mau\s*ao|ao\s*thun|ao|o|thiet\s*ke|hinh|graphic|artwork|print)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
    .trim();
  return normalizeVietnameseLandmarkIdea(cleaned);
}

function normalizeVietnameseLandmarkIdea(idea) {
  const normalized = normalizeSearchText(idea);
  const parts = [];
  if (/\b(lang bac|l ng b c|lang chu tich ho chi minh|ho chi minh mausoleum)\b/.test(normalized)) {
    parts.push('Ho Chi Minh Mausoleum landmark');
  }
  if (/\b(dinh doc lap|dinh c l p|dinh thong nhat|independence palace)\b/.test(normalized)) {
    parts.push('Independence Palace Saigon landmark');
  }
  if (/\b(hoa sen|lotus|sen)\b/.test(normalized)) {
    parts.push('Vietnamese lotus flower');
  }
  return parts.length ? `${parts.join(' with ')} illustration` : idea;
}

function cleanSideTextPrompt(segment, side) {
  const sideWords = side === 'back'
    ? '(?:mat\\s*sau|phia\\s*sau|sau\\s*lung|lung\\s*ao|sau\\s*ao|sau|back)'
    : '(?:mat\\s*truoc|phia\\s*truoc|truoc\\s*ao|truoc|tru c|tr c|front)';

  return normalizeSearchText(segment)
    .replace(/\b(?:in|them|viet|chu|text|lettering|slogan|cau\s*chu|dong\s*chu|o|tren|vao|cho|phan)\b/giu, ' ')
    .replace(new RegExp(`\\b${sideWords}\\b`, 'giu'), ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
    .trim()
    .slice(0, 80);
}

function extractTextSides(prompt) {
  const segments = String(prompt || '').split(/[,;.\n]+/).map(part => part.trim()).filter(Boolean);
  const textSides = { front: '', back: '' };
  segments.forEach((segment) => {
    const searchable = normalizeSearchText(segment);
    const wantsText = /\b(chu|text|lettering|slogan|cau chu|dong chu|viet)\b/.test(searchable);
    if (!wantsText) return;
    const hasFront = /\b(mat truoc|phia truoc|truoc ao|in truoc|o truoc|tren truoc|front|truoc|tru c|tr c)\b/.test(searchable);
    const hasBack = /\b(mat sau|phia sau|sau ao|sau lung|lung ao|in sau|o sau|tren sau|back|sau)\b/.test(searchable);
    if (hasFront) textSides.front = cleanSideTextPrompt(segment, 'front') || textSides.front;
    if (hasBack) textSides.back = cleanSideTextPrompt(segment, 'back') || textSides.back;
  });
  return textSides.front || textSides.back ? textSides : null;
}

function addSideIdea(ideas, idea) {
  const clean = String(idea || '').trim();
  if (!clean) return;
  const key = normalizeSearchText(clean);
  if (!ideas.some((existing) => normalizeSearchText(existing) === key)) {
    ideas.push(clean);
  }
}

function extractPrintSides(prompt) {
  const rawPrompt = String(prompt || '').trim();
  const segments = rawPrompt.split(/[,;.\n]+/).map(part => part.trim()).filter(Boolean);
  const sideIdeas = { front: [], back: [] };

  segments.forEach((segment) => {
    const searchable = normalizeSearchText(segment);
    if (/\b(chu|text|lettering|slogan|cau chu|dong chu|viet)\b/.test(searchable)) return;
    const hasFront = /\b(mat truoc|phia truoc|truoc ao|in truoc|o truoc|tren truoc|front)\b/.test(searchable)
      || /\btruoc\b/.test(searchable)
      || /\btru c\b/.test(searchable)
      || /\btr c\b/.test(searchable);
    const hasBack = /\b(mat sau|phia sau|sau ao|sau lung|lung ao|in sau|o sau|tren sau|back)\b/.test(searchable)
      || /\bsau\b/.test(searchable);

    if (hasFront) addSideIdea(sideIdeas.front, cleanSidePrompt(segment, 'front'));
    if (hasBack) addSideIdea(sideIdeas.back, cleanSidePrompt(segment, 'back'));
  });

  if (sideIdeas.back.length && !sideIdeas.front.length && segments.length > 1) {
    const frontSegment = segments.find((segment) => {
      const searchable = normalizeSearchText(segment);
      return !(/\b(mat sau|phia sau|sau ao|sau lung|lung ao|back|sau)\b/.test(searchable));
    });
    if (frontSegment) addSideIdea(sideIdeas.front, cleanSidePrompt(frontSegment, 'front'));
  }

  const front = sideIdeas.front.join(' and ');
  const back = sideIdeas.back.join(' and ');

  if (!front && !back) return null;

  return {
    front: front || (back ? 'minimal complementary front chest artwork matching the same theme' : rawPrompt),
    back,
  };
}

function wantsLettering(prompt) {
  return /\b(text|lettering|typography|quote|slogan|word|words|phrase|caption|logo text|chu|chữ|slogan|câu nói|dòng chữ|typography)\b/i
    .test(String(prompt || ''));
}

function buildPrintArtworkPrompt({ prompt, style, fromImage = false, referenceMode = 'inspiration', side = null, originalPrompt = '', customText = '' }) {
  const styleKey = (style || DEFAULT_STYLE).toLowerCase();
  const styleText = STYLE_PROMPTS[styleKey] || STYLE_PROMPTS[DEFAULT_STYLE];
  const idea = normalizeDesignIdea(prompt);
  const exactText = normalizeCustomText(customText);
  const letteringInstruction = exactText
    ? `Include this exact text only if text is part of the artwork: "${exactText}". Keep it readable and do not invent extra words.`
    : wantsLettering(idea)
    ? 'If the user requested words or lettering, render only the exact requested words, with clean readable typography.'
    : 'Do not include any letters, words, captions, random symbols, signatures, or fake text.';
  const sourceInstruction = fromImage
    ? referenceMode === 'high-fidelity'
      ? 'Use the uploaded image as the primary visual reference. Preserve the main subject, pose, colors, silhouette, and recognizable details, while transforming it into an original print artwork.'
      : 'Use the uploaded image as reference context and combine it with the written idea. Keep the important visual traits from the image.'
    : 'Create a standalone print artwork from the written user idea.';
  const sideInstruction = side
    ? `This is the ${side === 'back' ? 'BACK' : 'FRONT'} print only. Generate only this side artwork: ${idea}. Do not include artwork meant for the other side.`
    : 'Generate one complete artwork for the requested print.';
  const originalInstruction = originalPrompt
    ? `Full customer request for context only: ${originalPrompt}. Follow only the side-specific artwork above when there is a conflict.`
    : '';

  return [
    'Create ONE finished print artwork for a custom apparel decal.',
    'Output must be artwork only, not a product mockup.',
    sourceInstruction,
    sideInstruction,
    originalInstruction,
    `User idea to follow exactly: ${idea}`,
    `Art direction: ${styleText}.`,
    'Composition: one large unmistakable main subject, strong silhouette, balanced negative space, square canvas, no tiny or low-contrast subject.',
    'Prompt fidelity: preserve every requested subject, color, place, action, object, mood, and cultural detail. Do not replace named references with generic substitutes.',
    'Print quality: premium merch illustration, sharp edges, crisp contours, clean contrast, polished professional finish, screen-print friendly.',
    'Background: plain light/transparent-looking background, no scene unless requested.',
    letteringInstruction,
    'Hard negative: no t-shirt, no hoodie, no polo shirt, no clothing outline, no hanger, no human model wearing apparel, no mannequin, no ecommerce product photo, no frame, no UI, no watermark.'
  ].filter(Boolean).join(' ');
}

function buildTshirtPrompt(options) {
  return buildPrintArtworkPrompt(options);
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

function sanitizeProviderError(message) {
  return String(message || 'Unknown provider error')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-api-key]')
    .slice(0, 500);
}

async function enhanceImagePrompt(prompt, style, fromImage = false, options = {}) {
  const fallbackPrompt = buildPrintArtworkPrompt({ prompt, style, fromImage, ...options });
  const exactText = normalizeCustomText(options.customText);

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
            'Convert the user request, often in Vietnamese, into a faithful English visual description.',
            'Return only the enhanced visual brief. No markdown. No explanations.',
            'The image must be standalone print artwork only, never a shirt mockup or product photo.',
            'Preserve every requested subject, place, season, color, number, action, relationship, and visual detail.',
            'Never replace a named place, landmark, person, animal, object, or cultural detail with a different one.',
            'For a named character, meme, brand-like visual reference, or cultural reference, retain the name and explicitly describe its distinctive visual traits so the image model preserves its identity.',
            'Translate faithfully instead of inventing new content. Resolve minor Vietnamese spelling mistakes from context without changing the meaning.',
            'Do not add unrelated objects, slogans, backgrounds, or new characters.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `User request: ${prompt || 'original graphic artwork'}`,
            exactText ? `Exact user text/slogan to preserve: "${exactText}"` : '',
            `Requested style: ${styleText}`,
            options.side ? `Side-specific instruction: create only the ${options.side} print artwork.` : '',
            options.originalPrompt ? `Original full request: ${options.originalPrompt}` : '',
            fromImage ? 'Reference mode: preserve important visual traits from the uploaded image and combine them with the user idea.' : '',
            'Requirements: make the requested subject unmistakable, centered, large, print-ready, crisp vector-like edges, plain light or transparent-looking background.',
            'Fidelity rule: include every meaningful detail from the user request and do not add unrelated landmarks, characters, objects, or text. Do not reduce a named reference to a generic version of the same category.',
            'Negative requirements: no t-shirt, no clothing, no apparel outline, no hanger, no model, no mannequin, no product photo, no UI, no watermark, no frame.',
          ].filter(Boolean).join('\n'),
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const enhanced = cleanEnhancedPrompt(extractTextResult(data));
    if (enhanced && enhanced.length >= 40) {
      return buildPrintArtworkPrompt({ prompt: enhanced, style, fromImage, ...options });
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

async function postOpenAIImageEdit(formData) {
  try {
    return await postOpenAIForm('https://api.openai.com/v1/images/edits', formData);
  } catch (err) {
    const message = err.message || '';
    if (/input_fidelity.*not support|does not support the 'input_fidelity' parameter|unknown parameter.*input_fidelity/i.test(message)) {
      return await postOpenAIForm('https://api.openai.com/v1/images/edits', cloneFormDataWithout(formData, ['input_fidelity']));
    }
    if (/transparent background is not supported|background.*not supported/i.test(message) && formData.has?.('background')) {
      return await postOpenAIForm('https://api.openai.com/v1/images/edits', cloneFormDataWithout(formData, ['background']));
    }
    throw err;
  }
}

function extractImageUrl(data) {
  return (
    data?.data?.[0]?.url ||
    data?.result?.url ||
    data?.result?.image_url ||
    data?.url ||
    data?.image_url
  );
}

async function saveImageResponse(data, designId) {
  const base64Image = extractBase64Image(data);
  if (base64Image) {
    return saveGeneratedImage(base64Image, designId);
  }

  const imageUrl = extractImageUrl(data);
  if (imageUrl && typeof fetch === 'function') {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Generated image download failed with status ${response.status}`);
    }
    return saveGeneratedImageBuffer(Buffer.from(await response.arrayBuffer()), designId);
  }

  throw new Error('AI response did not include image data.');
}

function isGptImageModel(model = OPENAI_IMAGE_MODEL) {
  return /^gpt-image|^chatgpt-image/i.test(model);
}

function supportsTransparentBackground(model = OPENAI_IMAGE_MODEL) {
  return !/^gpt-image-2$/i.test(model);
}

function buildOpenAIImageBody(prompt) {
  const body = {
    model: OPENAI_IMAGE_MODEL,
    prompt,
    size: OPENAI_IMAGE_SIZE,
  };

  if (isGptImageModel()) {
    body.quality = OPENAI_IMAGE_QUALITY;
    body.background = OPENAI_IMAGE_BACKGROUND === 'transparent' && !supportsTransparentBackground()
      ? 'auto'
      : OPENAI_IMAGE_BACKGROUND;
    body.output_format = OPENAI_IMAGE_OUTPUT_FORMAT;
  } else {
    body.response_format = 'b64_json';
  }

  return body;
}

async function generateCloudflareImage(prompt, style, designId, promptOptions = {}) {
  const finalPrompt = await enhanceImagePrompt(prompt, style, false, promptOptions);
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

async function generateOpenAIImage(prompt, style, designId, promptOptions = {}) {
  const finalPrompt = await enhanceImagePrompt(prompt, style, false, promptOptions);
  const data = await postOpenAIImageGeneration(buildOpenAIImageBody(finalPrompt));

  return { designUrl: await saveImageResponse(data, designId), finalPrompt };
}

async function generateOpenAIProductMockup(prompt, style, designId) {
  const finalProductPrompt = buildProductMockupPrompt({ prompt, style });
  const data = await postOpenAIImageGeneration(buildOpenAIImageBody(finalProductPrompt));

  return {
    productMockupUrl: await saveImageResponse(data, `${designId}-product`),
    finalProductPrompt,
  };
}

async function postOpenAIImageGeneration(body) {
  try {
    return await postOpenAIJson('https://api.openai.com/v1/images/generations', body);
  } catch (err) {
    if (/transparent background is not supported|background.*not supported/i.test(err.message || '') && body.background) {
      const retryBody = { ...body };
      delete retryBody.background;
      return await postOpenAIJson('https://api.openai.com/v1/images/generations', retryBody);
    }
    throw err;
  }
}

function supportsInputFidelity(model = OPENAI_IMAGE_MODEL) {
  return !/^gpt-image-2$/i.test(model);
}

function cloneFormDataWithout(formData, omittedKeys = []) {
  const clone = new FormData();
  const omitted = new Set(omittedKeys);
  for (const [key, value] of formData.entries()) {
    if (!omitted.has(key)) clone.append(key, value);
  }
  return clone;
}

async function editOpenAIImage(file, idea, designId, style = DEFAULT_STYLE, customText = '') {
  const enhancedReferencePrompt = await enhanceImagePrompt(
    idea || 'Turn this reference image into an original standalone print graphic',
    style,
    true,
    { customText }
  );
  const prompt = buildPrintArtworkPrompt({
    prompt: enhancedReferencePrompt,
    style,
    fromImage: true,
    referenceMode: 'high-fidelity',
    customText,
  });
  const legacyPrompt = buildPrintArtworkPrompt({
    prompt: idea || 'Turn this image into an original standalone print graphic',
    style,
    fromImage: true,
    customText,
  });
  const buffer = fs.readFileSync(file.path);
  const formData = new FormData();

  formData.append('model', OPENAI_IMAGE_MODEL);
  formData.append('prompt', prompt || legacyPrompt);
  formData.append('size', OPENAI_IMAGE_SIZE);
  if (isGptImageModel()) {
    formData.append('quality', OPENAI_IMAGE_QUALITY);
    formData.append('background', OPENAI_IMAGE_BACKGROUND);
    formData.append('output_format', OPENAI_IMAGE_OUTPUT_FORMAT);
    if (supportsInputFidelity()) {
      formData.append('input_fidelity', 'high');
    }
  }
  formData.append('image', new Blob([buffer], { type: file.mimetype }), file.originalname);

  const data = await postOpenAIImageEdit(formData);
  return { designUrl: await saveImageResponse(data, designId), finalPrompt: prompt || legacyPrompt };
}

function saveDesignRecord({
  designId,
  prompt,
  style,
  author,
  userId,
  designUrl,
  frontDesignUrl,
  backDesignUrl,
  productMockupUrl,
  productMockupBlank,
  sourceImage,
  finalPrompt,
  finalFrontPrompt,
  finalBackPrompt,
  finalProductPrompt,
  printSides,
  customText,
  customTextSides,
}) {
  const designs = readDesigns();
  designs.push({
    id: designId,
    prompt,
    promptEn: prompt,
    style: style || DEFAULT_STYLE,
    author: author || 'Guest',
    userId,
    likes: 0,
    isShared: false,
    sharedAt: null,
    createdAt: new Date().toISOString().split('T')[0],
    designUrl,
    frontDesignUrl,
    backDesignUrl,
    productMockupUrl,
    productMockupBlank: Boolean(productMockupBlank),
    sourceImage,
    finalPrompt,
    finalFrontPrompt,
    finalBackPrompt,
    finalProductPrompt,
    printSides,
    customText,
    customTextSides,
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

// ---------------------------------------------------------------------------
// POST /api/ai-design/generate
// AI design generation from text prompt
// ---------------------------------------------------------------------------
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { prompt, style } = req.body;
    const customText = normalizeCustomText(req.body.customText);
    const customTextSides = extractTextSides(prompt);

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'A prompt is required.' });
    }

    const designId = 'design-' + Date.now();
    const authorName = req.user.fullName || req.user.username;
    let designUrl;
    let frontDesignUrl;
    let backDesignUrl;
    let productMockupUrl;
    let finalPrompt;
    let finalFrontPrompt;
    let finalBackPrompt;
    let finalProductPrompt;
    let provider = 'mock';
    const providerErrors = [];
    const printSides = extractPrintSides(prompt);

    for (const candidate of getProviderPriority()) {
      if (designUrl) break;

      if (candidate === 'openai' && hasOpenAIConfig()) {
        try {
          if (printSides?.back) {
            const [frontResult, backResult] = await Promise.all([
              generateOpenAIImage(printSides.front, style, `${designId}-front`, {
                side: 'front',
                originalPrompt: prompt,
                customText,
              }),
              generateOpenAIImage(printSides.back, style, `${designId}-back`, {
                side: 'back',
                originalPrompt: prompt,
                customText,
              }),
            ]);
            frontDesignUrl = frontResult.designUrl;
            backDesignUrl = backResult.designUrl;
            designUrl = frontDesignUrl;
            finalFrontPrompt = frontResult.finalPrompt;
            finalBackPrompt = backResult.finalPrompt;
            finalPrompt = finalFrontPrompt;
          } else {
            const result = await generateOpenAIImage(printSides?.front || prompt, style, designId, printSides?.front ? {
              side: 'front',
              originalPrompt: prompt,
              customText,
            } : { customText });
            designUrl = result.designUrl;
            frontDesignUrl = result.designUrl;
            finalPrompt = result.finalPrompt;
            finalFrontPrompt = result.finalPrompt;
          }
          if (ENABLE_AI_PRODUCT_MOCKUP) {
            try {
              const productResult = await generateOpenAIProductMockup(prompt, style, designId);
              productMockupUrl = productResult.productMockupUrl;
              finalProductPrompt = productResult.finalProductPrompt;
            } catch (mockupErr) {
              console.warn(`[AI-Design] OpenAI product mockup failed, continuing with print design: ${mockupErr.message}`);
            }
          }
          provider = 'openai';
        } catch (err) {
          const message = sanitizeProviderError(err.message);
          providerErrors.push(`OpenAI: ${message}`);
          console.warn(`[AI-Design] OpenAI generation failed, trying next provider: ${message}`);
        }
      }

      if (candidate === 'cloudflare' && hasCloudflareConfig()) {
        try {
          if (printSides?.back) {
            const [frontResult, backResult] = await Promise.all([
              generateCloudflareImage(printSides.front, style, `${designId}-front`, {
                side: 'front',
                originalPrompt: prompt,
                customText,
              }),
              generateCloudflareImage(printSides.back, style, `${designId}-back`, {
                side: 'back',
                originalPrompt: prompt,
                customText,
              }),
            ]);
            frontDesignUrl = frontResult.designUrl;
            backDesignUrl = backResult.designUrl;
            designUrl = frontDesignUrl;
            finalFrontPrompt = frontResult.finalPrompt;
            finalBackPrompt = backResult.finalPrompt;
            finalPrompt = finalFrontPrompt;
          } else {
            const result = await generateCloudflareImage(printSides?.front || prompt, style, designId, printSides?.front ? {
              side: 'front',
              originalPrompt: prompt,
              customText,
            } : { customText });
            designUrl = result.designUrl;
            frontDesignUrl = result.designUrl;
            finalPrompt = result.finalPrompt;
            finalFrontPrompt = result.finalPrompt;
          }
          if (ENABLE_AI_PRODUCT_MOCKUP) {
            try {
              const productResult = await generateCloudflareProductMockup(prompt, style, designId);
              productMockupUrl = productResult.productMockupUrl;
              finalProductPrompt = productResult.finalProductPrompt;
            } catch (mockupErr) {
              console.warn(`[AI-Design] Cloudflare product mockup failed, continuing with print design: ${mockupErr.message}`);
            }
          }
          provider = 'cloudflare';
        } catch (err) {
          const message = sanitizeProviderError(err.message);
          providerErrors.push(`Cloudflare: ${message}`);
          console.warn(`[AI-Design] Cloudflare generation failed, trying next provider: ${message}`);
        }
      }
    }

    if (!designUrl) {
      if (providerErrors.length && (hasOpenAIConfig() || hasCloudflareConfig())) {
        return res.status(502).json({
          success: false,
          error: 'AI provider failed. Please check the API key, billing, model access, or provider configuration.',
          providerErrors,
        });
      }
      designUrl = getDesignSvg(style);
      frontDesignUrl = designUrl;
    }

    console.log(`[AI-Design] Generated design ${designId} via ${provider} for prompt: "${prompt}" (style: ${style || DEFAULT_STYLE})`);
    saveDesignRecord({
      designId,
      prompt,
      style: style || DEFAULT_STYLE,
      author: authorName,
      userId: req.user.id,
      designUrl,
      frontDesignUrl,
      backDesignUrl,
      productMockupUrl,
      productMockupBlank: Boolean(productMockupUrl),
      finalPrompt,
      finalFrontPrompt,
      finalBackPrompt,
      finalProductPrompt,
      printSides,
      customText,
      customTextSides,
      isShared: false,
    });

    res.json({
      success: true,
      designId,
      designUrl,
      frontDesignUrl,
      backDesignUrl,
      productMockupUrl,
      productMockupBlank: Boolean(productMockupUrl),
      prompt,
      style: style || DEFAULT_STYLE,
      author: authorName,
      provider,
      finalPrompt,
      finalFrontPrompt,
      finalBackPrompt,
      finalProductPrompt,
      printSides,
      customText,
      customTextSides,
      isShared: false,
    });
  } catch (err) {
    console.error('[AI-Design] Error generating design:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate design' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-design/generate-from-image
// AI design generation from an uploaded image
// ---------------------------------------------------------------------------
router.post('/generate-from-image', authenticate, upload.single('image'), async (req, res) => {
  try {
    const idea = req.body.idea || '';
    const style = req.body.style || DEFAULT_STYLE;
    const author = req.user.fullName || req.user.username;
    const customText = normalizeCustomText(req.body.customText);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'An image file is required.' });
    }

    const designId = 'design-' + Date.now();
    let designUrl;
    let finalPrompt;
    let provider = 'mock';
    const providerErrors = [];

    for (const candidate of getProviderPriority({ requireImageInput: true })) {
      if (designUrl) break;

      if (candidate === 'openai' && hasOpenAIConfig() && typeof FormData !== 'undefined' && typeof Blob !== 'undefined') {
        try {
          const result = await editOpenAIImage(file, idea, designId, style, customText);
          designUrl = result.designUrl;
          finalPrompt = result.finalPrompt;
          provider = 'openai';
        } catch (err) {
          const message = sanitizeProviderError(err.message);
          providerErrors.push(`OpenAI: ${message}`);
          console.warn(`[AI-Design] OpenAI image edit failed, trying next provider: ${message}`);
        }
      }

      if (candidate === 'cloudflare' && hasCloudflareConfig()) {
        try {
          const result = await generateCloudflareImage(
            idea || 'Create an original standalone print graphic inspired by the uploaded reference image',
            style,
            designId,
            { customText }
          );
          designUrl = result.designUrl;
          finalPrompt = `${result.finalPrompt}\n\nNote: Cloudflare fallback cannot inspect the uploaded pixels in this app; OpenAI image edit is used first when configured.`;
          provider = 'cloudflare-text-fallback';
        } catch (err) {
          const message = sanitizeProviderError(err.message);
          providerErrors.push(`Cloudflare: ${message}`);
          console.warn(`[AI-Design] Cloudflare image generation failed, trying next provider: ${message}`);
        }
      }
    }

    if (!designUrl) {
      if (providerErrors.length && (hasOpenAIConfig() || hasCloudflareConfig())) {
        return res.status(502).json({
          success: false,
          error: 'AI provider failed. Please check the API key, billing, model access, or provider configuration.',
          providerErrors,
        });
      }
      designUrl = getFromImageSvg();
    }

    console.log(`[AI-Design] Generated design ${designId} via ${provider} from image: "${file.filename}" idea: "${idea}"`);
    saveDesignRecord({
      designId,
      prompt: idea || 'Remix from image',
      style,
      author,
      userId: req.user.id,
      designUrl,
      sourceImage: `/uploads/${file.filename}`,
      finalPrompt,
      customText,
      isShared: false,
    });

    res.json({
      success: true,
      designId,
      designUrl,
      uploadedFile: file.filename,
      idea,
      style,
      author,
      provider,
      finalPrompt,
      customText,
      isShared: false,
    });
  } catch (err) {
    console.error('[AI-Design] Error generating from image:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate design from image' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-design/:id/share
// Publish a generated design to the public community gallery
// ---------------------------------------------------------------------------
router.post('/:id/share', authenticate, (req, res) => {
  try {
    const designId = req.params.id;
    const designs = readDesigns();
    const design = designs.find((item) => item.id === designId);

    if (!design) {
      return res.status(404).json({ success: false, error: 'Design not found.' });
    }

    if (design.userId && design.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only share your own design.' });
    }

    design.isShared = true;
    design.sharedAt = new Date().toISOString();
    design.author = design.author || req.user.fullName || req.user.username || 'Guest';
    writeDesigns(designs);

    res.json({ success: true, data: design });
  } catch (err) {
    console.error('[AI-Design] Error sharing design:', err.message);
    res.status(500).json({ success: false, error: 'Failed to share design' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ai-design/gallery
// Return sample designs with their SVG thumbnails
// ---------------------------------------------------------------------------
router.get('/gallery', (_req, res) => {
  try {
    const designs = readDesigns();
    const publicDesigns = designs.filter((d) => d.isShared !== false);
    const galleryWithImages = publicDesigns.map((d) => ({
      ...d,
      designUrl: d.designUrl || (d.sourceImage ? getFromImageSvg() : getDesignSvg(d.style)),
      productMockupUrl: d.productMockupUrl || null,
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
