// backend/services/ai-providers/openai.provider.js
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
    data?.b64_json
  );
}

async function postOpenAIJson(apiKey, model, prompt, size, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size }),
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data.error?.message || `OpenAI request failed with status ${resp.status}`;
      const err = new Error(msg);
      err.statusCode = resp.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function postOpenAIForm(apiKey, formData, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data.error?.message || `OpenAI request failed with status ${resp.status}`;
      const err = new Error(msg);
      err.statusCode = resp.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

class OpenAIProvider extends BaseAIProvider {
  constructor(config) {
    super('openai', config);
    this.apiKey = config.openai.apiKey;
    this.model = config.openai.model;
    this.timeoutMs = config.openai.timeoutMs || 90000;
  }

  isAvailable() {
    return this.config.openai.enabled && !!this.apiKey && typeof fetch === 'function';
  }

  async generateImage({ prompt, designId, finalPrompt, size = '1024x1024' }) {
    if (!this.isAvailable()) {
      throw new AIProviderError({ provider: this.name, code: 'CONFIG_ERROR', message: 'OpenAI not configured', retryable: false });
    }
    try {
      const data = await postOpenAIJson(this.apiKey, this.model, finalPrompt || prompt, size, this.timeoutMs);
      const url = saveGeneratedImage(extractBase64Image(data), designId);
      return { designUrl: url, finalPrompt };
    } catch (e) {
      const retryable = e.name === 'AbortError' || (e.statusCode >= 500 && e.statusCode < 600) || e.statusCode === 429;
      throw new AIProviderError({ provider: this.name, code: e.code || 'OPENAI_ERROR', message: e.message, retryable, statusCode: e.statusCode || 500 });
    }
  }

  async generateFromImage({ file, idea, designId, finalPrompt, size = '1024x1024' }) {
    if (!this.isAvailable()) {
      throw new AIProviderError({ provider: this.name, code: 'CONFIG_ERROR', message: 'OpenAI not configured', retryable: false });
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
      formData.append('image[]', new Blob([buffer], { type: file.mimetype }), file.originalname);
      const data = await postOpenAIForm(this.apiKey, formData, this.timeoutMs);
      const url = saveGeneratedImage(extractBase64Image(data), designId);
      return { designUrl: url, finalPrompt };
    } catch (e) {
      const retryable = e.name === 'AbortError' || (e.statusCode >= 500 && e.statusCode < 600) || e.statusCode === 429;
      throw new AIProviderError({ provider: this.name, code: e.code || 'OPENAI_ERROR', message: e.message, retryable, statusCode: e.statusCode || 500 });
    }
  }
}

module.exports = { OpenAIProvider };
