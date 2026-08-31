// backend/services/ai-providers/base.provider.js
class AIProviderError extends Error {
  constructor({ provider, code, message, retryable = false, statusCode = 500 }) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

class BaseAIProvider {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  getName() {
    return this.name;
  }

  // Must be overridden: true if provider can be called (enabled + has required keys)
  isAvailable() {
    return false;
  }

  // Generate image from prompt. Must return { designUrl, finalPrompt? } or throw AIProviderError
  // opts: { prompt, style, designId, enhancedPrompt? }
  async generateImage(opts) {
    throw new AIProviderError({ provider: this.name, code: 'NOT_IMPLEMENTED', message: 'generateImage not implemented', retryable: false });
  }

  // Generate from image (multipart). opts: { file, idea, designId }
  async generateFromImage(opts) {
    throw new AIProviderError({ provider: this.name, code: 'NOT_IMPLEMENTED', message: 'generateFromImage not implemented', retryable: false });
  }

  // Optional: generate product mockup? If provider supports, else can no-op
  async generateProductMockup(opts) {
    return null;
  }
}

module.exports = { BaseAIProvider, AIProviderError };
