/**
 * Markdown 预览器翻译功能模块
 *
 * 功能：
 * - 选中文本弹出翻译按钮
 * - 支持中英互译（自动检测语言）
 * - 使用浮动卡片展示翻译结果
 *
 * 使用方式：
 * 1. 引入此文件：<script src="translation-feature.js"></script>
 * 2. 调用 initTranslation('#preview')
 */

class TranslationFeature {
  constructor(previewSelector) {
    this.previewElement = document.querySelector(previewSelector);
    this.currentSelection = null;
    this.tooltipElement = null;
    this.resultCard = null;

    // 配置：选择翻译服务
    this.config = {
      service: 'chrome-builtin',  // 'chrome-builtin' | 'baidu' | 'ollama'

      // 百度翻译配置（需要替换）
      baidu: {
        appid: 'YOUR_APP_ID',
        key: 'YOUR_SECRET_KEY'
      },

      // Ollama 配置
      ollama: {
        endpoint: 'http://localhost:11434/api/generate',
        model: 'llama3.2:3b'
      }
    };

    this.init();
  }

  init() {
    if (!this.previewElement) {
      console.warn('Translation: Preview element not found');
      return;
    }

    // 监听文本选择
    this.previewElement.addEventListener('mouseup', (e) => {
      this.handleTextSelection(e);
    });

    // 点击其他地方关闭
    document.addEventListener('mousedown', (e) => {
      if (this.tooltipElement && !this.tooltipElement.contains(e.target)) {
        this.hideTooltip();
      }
      if (this.resultCard && !this.resultCard.contains(e.target)) {
        this.hideResultCard();
      }
    });
  }

  handleTextSelection(event) {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    // 移除旧工具提示
    this.hideTooltip();

    // 检查选中文本长度
    if (text.length > 0 && text.length < 5000) {
      this.currentSelection = text;
      this.showTooltip(event.pageX, event.pageY);
    }
  }

  showTooltip(x, y) {
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'translation-tooltip';
    this.tooltipElement.innerHTML = `
      <button class="translate-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M5 8h6m-6 4h6m-6 4h6m6-8v8m-3-4h6"/>
        </svg>
        翻译
      </button>
    `;

    this.tooltipElement.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y - 50}px;
      background: #000000;
      color: #ffffff;
      padding: 8px 12px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      cursor: pointer;
    `;

    document.body.appendChild(this.tooltipElement);

    // 绑定点击事件
    this.tooltipElement.querySelector('.translate-btn').addEventListener('click', () => {
      this.translateSelection();
    });
  }

  hideTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  async translateSelection() {
    if (!this.currentSelection) return;

    this.hideTooltip();
    this.showLoading();

    try {
      const result = await this.translate(this.currentSelection);
      this.showResult(this.currentSelection, result);
    } catch (error) {
      this.showError(error.message);
    }
  }

  async translate(text) {
    const service = this.config.service;

    if (service === 'chrome-builtin') {
      return await this.translateWithChrome(text);
    } else if (service === 'baidu') {
      return await this.translateWithBaidu(text);
    } else if (service === 'ollama') {
      return await this.translateWithOllama(text);
    } else {
      throw new Error('未配置翻译服务');
    }
  }

  async translateWithChrome(text) {
    if (!window.translation) {
      throw new Error('浏览器不支持 Translation API（需要 Chrome 130+）');
    }

    // 检测语言
    const detector = await window.translation.createDetector();
    const results = await detector.detect(text);
    const detectedLang = results[0]?.detectedLanguage || 'zh';

    // 确定目标语言
    const targetLang = detectedLang === 'zh' ? 'en' : 'zh';

    // 创建翻译器
    const translator = await window.translation.createTranslator({
      sourceLanguage: detectedLang,
      targetLanguage: targetLang
    });

    const result = await translator.translate(text);

    return {
      original: text,
      translated: result,
      sourceLang: detectedLang,
      targetLang: targetLang
    };
  }

  async translateWithBaidu(text) {
    // 检测是否为中文
    const isChinese = /[一-龥]/.test(text);
    const from = isChinese ? 'zh' : 'en';
    const to = isChinese ? 'en' : 'zh';

    const { appid, key } = this.config.baidu;
    const salt = Date.now();

    // 生成签名（需要引入 md5 库或使用 Web Crypto API）
    const signStr = appid + text + salt + key;
    const sign = await this.md5(signStr);

    const params = new URLSearchParams({
      q: text,
      from,
      to,
      appid,
      salt,
      sign
    });

    const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
      method: 'POST',
      body: params
    });

    const data = await response.json();

    if (data.error_code) {
      throw new Error(`百度翻译错误：${data.error_msg}`);
    }

    return {
      original: text,
      translated: data.trans_result[0].dst,
      sourceLang: from,
      targetLang: to
    };
  }

  async translateWithOllama(text) {
    const { endpoint, model } = this.config.ollama;

    // 检测语言并构造 prompt
    const isChinese = /[一-龥]/.test(text);
    const prompt = isChinese
      ? `Translate the following Chinese text to English. Only output the translation, no explanations:\n\n${text}`
      : `将以下英文翻译成中文。只输出翻译结果，不要解释：\n\n${text}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error('Ollama 服务不可用，请确保已启动 Ollama');
    }

    const data = await response.json();

    return {
      original: text,
      translated: data.response.trim(),
      sourceLang: isChinese ? 'zh' : 'en',
      targetLang: isChinese ? 'en' : 'zh'
    };
  }

  showLoading() {
    this.resultCard = document.createElement('div');
    this.resultCard.className = 'translation-result-card';
    this.resultCard.innerHTML = `
      <div class="translation-loading">
        <div class="spinner"></div>
        <span>翻译中...</span>
      </div>
    `;

    this.resultCard.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      padding: 24px;
      min-width: 400px;
      max-width: 600px;
      z-index: 2000;
    `;

    document.body.appendChild(this.resultCard);
  }

  showResult(original, result) {
    if (!this.resultCard) return;

    const langNames = {
      zh: '中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어'
    };

    this.resultCard.innerHTML = `
      <div class="translation-result">
        <div class="translation-header">
          <span class="lang-label">${langNames[result.sourceLang] || result.sourceLang}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M5 12h14m-7-7l7 7-7 7"/>
          </svg>
          <span class="lang-label">${langNames[result.targetLang] || result.targetLang}</span>
          <button class="close-btn" onclick="this.closest('.translation-result-card').remove()">✕</button>
        </div>

        <div class="translation-content">
          <div class="translation-section">
            <div class="section-label">原文</div>
            <div class="section-text">${this.escapeHtml(original)}</div>
          </div>

          <div class="translation-divider"></div>

          <div class="translation-section">
            <div class="section-label">译文</div>
            <div class="section-text translation-result-text">${this.escapeHtml(result.translated)}</div>
          </div>
        </div>

        <div class="translation-actions">
          <button class="action-btn" onclick="navigator.clipboard.writeText('${this.escapeHtml(result.translated).replace(/'/g, "\\'")}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            复制译文
          </button>
        </div>
      </div>
    `;

    // 添加样式
    if (!document.getElementById('translation-styles')) {
      const style = document.createElement('style');
      style.id = 'translation-styles';
      style.textContent = `
        .translation-tooltip {
          animation: fadeIn 0.2s ease;
        }

        .translate-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: inherit;
          font-size: 14px;
          cursor: pointer;
        }

        .translation-loading {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: #666;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e0e0e0;
          border-top-color: #0066cc;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .translation-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          font-size: 14px;
          color: #666;
        }

        .lang-label {
          font-weight: 500;
          color: #000;
        }

        .close-btn {
          margin-left: auto;
          background: transparent;
          border: none;
          font-size: 20px;
          color: #999;
          cursor: pointer;
          padding: 4px;
        }

        .close-btn:hover {
          color: #000;
        }

        .translation-section {
          margin-bottom: 16px;
        }

        .section-label {
          font-size: 12px;
          color: #999;
          margin-bottom: 8px;
        }

        .section-text {
          font-size: 15px;
          line-height: 1.6;
          color: #1d1d1f;
        }

        .translation-result-text {
          font-weight: 500;
        }

        .translation-divider {
          height: 1px;
          background: #e0e0e0;
          margin: 16px 0;
        }

        .translation-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f5f5f7;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 14px;
          color: #000;
          cursor: pointer;
        }

        .action-btn:hover {
          background: #e8e8ed;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  showError(message) {
    if (!this.resultCard) return;

    this.resultCard.innerHTML = `
      <div class="translation-error">
        <div style="color: #ff3b30; font-size: 16px; margin-bottom: 8px;">翻译失败</div>
        <div style="color: #666; font-size: 14px;">${this.escapeHtml(message)}</div>
        <button onclick="this.closest('.translation-result-card').remove()"
                style="margin-top: 16px; padding: 8px 16px; background: #f5f5f7; border: none; border-radius: 8px; cursor: pointer;">
          关闭
        </button>
      </div>
    `;
  }

  hideResultCard() {
    if (this.resultCard) {
      this.resultCard.remove();
      this.resultCard = null;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 简单的 MD5 实现（用于百度翻译签名）
  async md5(string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(string);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// 初始化函数
function initTranslation(previewSelector = '#preview', config = {}) {
  const translation = new TranslationFeature(previewSelector);

  // 允许外部配置覆盖
  if (config.service) translation.config.service = config.service;
  if (config.baidu) translation.config.baidu = { ...translation.config.baidu, ...config.baidu };
  if (config.ollama) translation.config.ollama = { ...translation.config.ollama, ...config.ollama };

  return translation;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TranslationFeature, initTranslation };
}
