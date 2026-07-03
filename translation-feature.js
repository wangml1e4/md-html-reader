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
      service: 'ollama',  // 'ollama' | 'tencent'
      quickView: true,    // 选中后快速查看（无需点击按钮）

      // 腾讯翻译配置（需要替换）
      tencent: {
        secretId: 'YOUR_SECRET_ID',
        secretKey: 'YOUR_SECRET_KEY',
        region: 'ap-beijing'  // 可选：ap-shanghai, ap-guangzhou
      },

      // Ollama 配置
      ollama: {
        endpoint: 'http://localhost:11434/api/generate',
        model: 'qwen3.5:2b'
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

    // 移除旧工具提示和结果卡片
    this.hideTooltip();
    this.hideResultCard();

    // 检查选中文本长度
    if (text.length > 0 && text.length < 5000) {
      this.currentSelection = text;

      // 快速查看模式：直接翻译，不显示中间按钮
      if (this.config.quickView) {
        this.translateSelection();
      } else {
        this.showTooltip(event.pageX, event.pageY);
      }
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

    if (service === 'tencent') {
      return await this.translateWithTencent(text);
    } else if (service === 'ollama') {
      return await this.translateWithOllama(text);
    } else {
      throw new Error('未配置翻译服务（支持：tencent / ollama）');
    }
  }

  async translateWithTencent(text) {
    // 检测是否为中文
    const isChinese = /[一-龥]/.test(text);
    const source = isChinese ? 'zh' : 'en';
    const target = isChinese ? 'en' : 'zh';

    const { secretId, secretKey, region = 'ap-beijing' } = this.config.tencent;

    // 腾讯云 API v3 签名
    const endpoint = 'tmt.tencentcloudapi.com';
    const service = 'tmt';
    const version = '2018-03-21';
    const action = 'TextTranslate';
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];

    // 请求参数
    const params = {
      SourceText: text,
      Source: source,
      Target: target,
      ProjectId: 0
    };

    // 构造规范请求串
    const payload = JSON.stringify(params);
    const hashedPayload = await this.sha256Hex(payload);

    const canonicalHeaders = `content-type:application/json\nhost:${endpoint}\n`;
    const signedHeaders = 'content-type;host';
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;

    // 构造待签名字符串
    const algorithm = 'TC3-HMAC-SHA256';
    const hashedCanonicalRequest = await this.sha256Hex(canonicalRequest);
    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    // 计算签名
    const secretDate = await this.hmacSha256('TC3' + secretKey, date);
    const secretService = await this.hmacSha256(secretDate, service);
    const secretSigning = await this.hmacSha256(secretService, 'tc3_request');
    const signature = await this.hmacSha256Hex(secretSigning, stringToSign);

    // 构造 Authorization 头
    const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // 发送请求
    const response = await fetch(`https://${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': endpoint,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Region': region,
        'Authorization': authorization
      },
      body: payload
    });

    const data = await response.json();

    if (data.Response.Error) {
      throw new Error(`腾讯翻译错误：${data.Response.Error.Message}`);
    }

    return {
      original: text,
      translated: data.Response.TargetText,
      sourceLang: source,
      targetLang: target
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
        stream: false,
        think: false,       // 关闭 thinking 模式（qwen3.5 等推理模型），加快翻译
        options: {
          temperature: 0.3,  // 翻译任务用低温度，结果更稳定
          num_predict: 512   // 限制输出长度，避免冗长
        }
      })
    });

    if (!response.ok) {
      throw new Error('Ollama 服务不可用，请确保已启动 Ollama');
    }

    const data = await response.json();

    // 清理可能残留的 <think> 标签内容（部分模型即使 think:false 仍会输出）
    let translated = (data.response || '').trim();
    translated = translated.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    return {
      original: text,
      translated: translated,
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

  // 腾讯云签名相关工具函数
  async sha256Hex(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async hmacSha256(key, message) {
    const keyBuffer = typeof key === 'string'
      ? new TextEncoder().encode(key)
      : key;
    const msgBuffer = new TextEncoder().encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
    return new Uint8Array(signature);
  }

  async hmacSha256Hex(key, message) {
    const signature = await this.hmacSha256(key, message);
    return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// 初始化函数
function initTranslation(previewSelector = '#preview', config = {}) {
  const translation = new TranslationFeature(previewSelector);

  // 允许外部配置覆盖
  if (config.service) translation.config.service = config.service;
  if (config.quickView !== undefined) translation.config.quickView = config.quickView;
  if (config.tencent) translation.config.tencent = { ...translation.config.tencent, ...config.tencent };
  if (config.ollama) translation.config.ollama = { ...translation.config.ollama, ...config.ollama };

  return translation;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TranslationFeature, initTranslation };
}
