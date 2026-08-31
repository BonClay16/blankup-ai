// backend/services/ai-providers/cloudflare.provider.js
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
function saveGeneratedImageBuffer(buffer, designId) {
  if (!buffer || !buffer.length) throw new Error('AI response did not include image data.');
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

async function postCloudflareJson(accountId, apiToken, model, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('image/')) {
      if (!resp.ok) throw new Error(`Cloudflare request failed with status ${resp.status}`);
      return { imageBuffer: Buffer.from(await resp.arrayBuffer()) };
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.success === false) {
      const msg = data.errors?.[0]?.message || data.error || `Cloudflare request failed with status ${resp.status}`;
      const err = new Error(msg);
      err.statusCode = resp.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

class CloudflareProvider extends BaseAIProvider {
  constructor(config) {
    super('cloudflare', config);
    this.accountId = config.cloudflare.accountId;
    this.apiToken = config.cloudflare.apiToken;
    this.imageModel = config.cloudflare.imageModel;
    this.timeoutMs = config.cloudflare.timeoutMs || 90000;
  }

  isAvailable() {
    return this.config.cloudflare.enabled && !!this.apiToken && !!this.accountId && typeof fetch === 'function';
  }

  async generateImage({ prompt, designId, finalPrompt }) {
    if (!this.isAvailable()) {
      throw new AIProviderError({ provider: this.name, code: 'CONFIG_ERROR', message: 'Cloudflare not configured', retryable: false });
    }
    try {
      const data = await postCloudflareJson(this.accountId, this.apiToken, this.imageModel, { prompt: finalPrompt || prompt }, this.timeoutMs);
      let designUrl;
      if (data.imageBuffer) designUrl = saveGeneratedImageBuffer(data.imageBuffer, designId);
      else designUrl = saveGeneratedImage(extractBase64Image(data), designId);
      return { designUrl, finalPrompt };
    } catch (e) {
      const retryable = e.name === 'AbortError' || (e.statusCode >= 500 && e.statusCode < 600) || e.statusCode === 429;
      throw new AIProviderError({ provider: this.name, code: e.code || 'CLOUDFLARE_ERROR', message: e.message, retryable, statusCode: e.statusCode || 500 });
    }
  }

  async generateFromImage({ idea, designId, finalPrompt }) {
    // Cloudflare generate-from-image not natively supported for t-shirt remix in blankup; use same generateImage with idea as prompt
    return this.generateImage({ prompt: finalPrompt || idea || 'Remix this reference image into an original t-shirt graphic', designId, finalPrompt });
  }

  // Product mockup via Cloudflare is optional; reuse same logic as before
  async generateProductMockup({ designId, finalProductPrompt }) {
    if (!this.isAvailable()) return null;
    try {
      const data = await postCloudflareJson(this.accountId, this.apiToken, this.imageModel, { prompt: finalProductPrompt }, this.timeoutMs);
      if (data.imageBuffer) return saveGeneratedImageBuffer(data.imageBuffer, `${designId}-product`);
      return saveGeneratedImage(extractBase64Image(data), `${designId}-product`);
    } catch {
      return null;
    }
  }
}

module.exports = { CloudflareProvider };
