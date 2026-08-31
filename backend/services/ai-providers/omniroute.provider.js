// backend/services/ai-providers/omniroute.provider.js
// OmniRoute is OpenAI-compatible gateway at http://localhost:20128/v1
// Supports POST /v1/images/generations and POST /v1/images/edits (multipart)
const fs = require('fs');
const path = require('path');
const { BaseAIProvider, AIProviderError } = require('./base.provider');

const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

function saveGeneratedImage(base64Image, designId) {
  if (!base64Image) throw new Error('AI response did not include image data.');
  const fileName = `${designId}.png`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(base64Image, 'base64'));
  return `/uploads/${fileName}`;
}
function extractBase64Image(data) {
  return (
    data?.data?.[0]?.b64_json ||
    data?.result?.image ||
    data?.result?.images?.[0] ||
    data?.image ||
    data?.images?.[0] ||
    data?.b64_json ||
    data?.data?.[0]?.url // OmniRoute may return url, but blankup expects b64; fallback will be handled elsewhere
  );
}

async function postOmnirouteJson(baseUrl, apiKey, model, prompt, size, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${baseUrl.replace(/\/$/, '')}/images/generations`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size }),
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data.error?.message || data.error || `OmniRoute request failed with status ${resp.status}`;
      const err = new Error(msg);
      err.statusCode = resp.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function postOmnirouteForm(baseUrl, apiKey, formData, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${baseUrl.replace(/\/$/, '')}/images/edits`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data.error?.message || data.error || `OmniRoute request failed with status ${resp.status}`;
      const err = new Error(msg);
      err.statusCode = resp.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

class OmniRouteProvider extends BaseAIProvider {
  constructor(config) {
    super('omniroute', config);
    this.baseUrl = config.omniroute.baseUrl;
    this.apiKey = config.omniroute.apiKey;
    this.model = config.omniroute.model;
    this.timeoutMs = config.omniroute.timeoutMs || 90000;
  }

  isAvailable() {
    return this.config.omniroute.enabled && !!this.apiKey && !!this.baseUrl && typeof fetch === 'function';
  }

  async generateImage({ prompt, designId, finalPrompt, size = '1024x1024' }) {
    if (!this.isAvailable()) {
      throw new AIProviderError({ provider: this.name, code: 'CONFIG_ERROR', message: 'OmniRoute not configured (missing API key or baseUrl)', retryable: false });
    }
    try {
      const data = await postOmnirouteJson(this.baseUrl, this.apiKey, this.model, finalPrompt || prompt, size, this.timeoutMs);
      // OmniRoute may return url instead of b64; if b64 missing but url present, we need to fetch url? For blankup we expect b64.
      // Handle both: if b64 present use it, else if url present fetch image bytes
      let b64 = extractBase64Image(data);
      if (!b64 && data?.data?.[0]?.url) {
        // Fetch image url to base64 (optional)
        const imgResp = await fetch(data.data[0].url);
        const buf = Buffer.from(await imgResp.arrayBuffer());
        b64 = buf.toString('base64');
      }
      const url = saveGeneratedImage(b64, designId);
      return { designUrl: url, finalPrompt };
    } catch (e) {
      const retryable = e.name === 'AbortError' || (e.statusCode >= 500 && e.statusCode < 600) || e.statusCode === 429;
      throw new AIProviderError({ provider: this.name, code: e.code || 'OMNIROUTE_ERROR', message: e.message, retryable, statusCode: e.statusCode || 500 });
    }
  }

  async generateFromImage({ file, idea, designId, finalPrompt, size = '1024x1024' }) {
    if (!this.isAvailable()) {
      throw new AIProviderError({ provider: this.name, code: 'CONFIG_ERROR', message: 'OmniRoute not configured', retryable: false });
    }
    if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
      throw new AIProviderError({ provider: this.name, code: 'UNSUPPORTED', message: 'FormData/Blob not available', retryable: false });
    }
    try {
      const buffer = fs.readFileSync(file.path);
      const formData = new FormData();
      formData.append('model', this.model);
      formData.append('prompt', finalPrompt || idea || 'Turn this image into an original t-shirt graphic');
      formData.append('size', size);
      // OmniRoute images/edits expects 'image' field (OpenAI spec)
      formData.append('image', new Blob([buffer], { type: file.mimetype }), file.originalname);
      // Also try image[] for compatibility
      // formData.append('image[]', ...) not needed for OmniRoute
      const data = await postOmnirouteForm(this.baseUrl, this.apiKey, formData, this.timeoutMs);
      let b64 = extractBase64Image(data);
      if (!b64 && data?.data?.[0]?.url) {
        const imgResp = await fetch(data.data[0].url);
        const buf = Buffer.from(await imgResp.arrayBuffer());
        b64 = buf.toString('base64');
      }
      const url = saveGeneratedImage(b64, designId);
      return { designUrl: url, finalPrompt };
    } catch (e) {
      const retryable = e.name === 'AbortError' || (e.statusCode >= 500 && e.statusCode < 600) || e.statusCode === 429;
      throw new AIProviderError({ provider: this.name, code: e.code || 'OMNIROUTE_ERROR', message: e.message, retryable, statusCode: e.statusCode || 500 });
    }
  }
}

module.exports = { OmniRouteProvider };
