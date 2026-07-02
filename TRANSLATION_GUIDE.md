# 翻译功能使用指南

## 功能概述

在 Markdown 预览器中新增中英文翻译功能，支持**选中文本快速查看翻译**。

## 快速开始

### 使用方法

1. **选中文本**：在预览区用鼠标选中要翻译的文本
2. **自动翻译**：翻译卡片自动弹出，无需点击按钮
3. **查看结果**：在卡片中查看原文和译文
4. **复制译文**：点击"复制译文"按钮将结果复制到剪贴板

### 交互特点

- ✅ **快速查看模式**：选中文本立即翻译，无中间按钮
- ✅ **自动语言检测**：智能识别中文↔英文方向
- ✅ **流畅动画**：Apple 风格卡片过渡
- ✅ **防误触**：点击其他地方自动关闭

---

## 支持的翻译服务

### 方案 1：Ollama 本地翻译 ⭐推荐

**优势**：
- ✅ 完全本地，无隐私问题
- ✅ 免费无限制
- ✅ 可定制 prompt（专业术语）
- ✅ 支持多种模型（llama3.2、qwen2 等）

**安装步骤**：

1. **下载 Ollama**
   ```bash
   # macOS
   brew install ollama
   
   # 或访问 https://ollama.com/download
   ```

2. **启动服务**
   ```bash
   ollama serve
   ```

3. **下载模型**（推荐 llama3.2:3b，2GB 大小）
   ```bash
   ollama pull llama3.2:3b
   ```

4. **配置使用**（默认配置，无需修改）
   ```javascript
   initTranslation('#preview', {
     service: 'ollama',
     ollama: {
       endpoint: 'http://localhost:11434/api/generate',
       model: 'llama3.2:3b'
     }
   });
   ```

**模型选择建议**：
- `llama3.2:3b` - 推荐，速度快，质量好（2GB）
- `qwen2:7b` - 中文能力强（4.4GB）
- `mistral:7b` - 通用翻译（4.1GB）

---

### 方案 2：腾讯翻译 API

**优势**：
- ✅ 翻译质量高（专业机器翻译）
- ✅ 跨浏览器支持
- ✅ 免费额度：每月 500 万字符
- ✅ 速度快（云端处理）

**申请步骤**：

1. **注册腾讯云账号**
   访问：https://cloud.tencent.com/

2. **开通机器翻译服务**
   - 控制台搜索"机器翻译"
   - 点击"立即使用"开通服务
   - 免费额度自动生效

3. **获取密钥**
   - 访问：https://console.cloud.tencent.com/cam/capi
   - 创建 API 密钥
   - 记录 SecretId 和 SecretKey

4. **配置使用**
   ```javascript
   initTranslation('#preview', {
     service: 'tencent',
     tencent: {
       secretId: 'AKIDxxxxxxxxxxxxxxxx',
       secretKey: 'xxxxxxxxxxxxxxxxxxxxxxxx',
       region: 'ap-beijing'  // 可选：ap-shanghai, ap-guangzhou
     }
   });
   ```

**定价**（超出免费额度后）：
- 0-500 万字符/月：免费
- 超出部分：58 元/百万字符

---

## 集成到现有页面

### Enhanced.html（已集成）

已在 `enhanced.html` 中完成集成，默认使用 **Ollama + 快速查看模式**。

### Editor.html 集成示例

```html
<!-- 1. 引入翻译模块 -->
<script src="translation-feature.js"></script>

<!-- 2. 在初始化代码中启用 -->
<script type="module">
  // ... 现有的 CodeMirror 初始化代码 ...

  window.addEventListener('load', () => {
    // 初始化翻译（快速查看模式）
    initTranslation('#preview', {
      service: 'ollama',
      quickView: true
    });
  });
</script>
```

### Comments.html 集成示例

```html
<!-- 1. 引入翻译模块 -->
<script src="translation-feature.js"></script>

<!-- 2. 在现有脚本中添加 -->
<script>
  // ... 现有的评论系统代码 ...

  // 初始化翻译（与评论选择共存）
  window.addEventListener('load', () => {
    initTranslation('#preview', {
      service: 'ollama',
      quickView: true
    });
  });
</script>
```

**兼容性说明**：翻译功能与评论系统的文本选择机制完全兼容。

---

## API 参考

### initTranslation(selector, config)

初始化翻译功能。

**参数**：
- `selector` (string)：预览区的 CSS 选择器，默认 `'#preview'`
- `config` (object)：配置对象
  - `service` (string)：翻译服务类型
    - `'ollama'`：Ollama 本地翻译（推荐）
    - `'tencent'`：腾讯翻译 API
  - `quickView` (boolean)：快速查看模式，默认 `true`
    - `true`：选中后直接翻译
    - `false`：选中后显示按钮，点击再翻译
  - `tencent` (object)：腾讯翻译配置
    - `secretId` (string)：密钥 ID
    - `secretKey` (string)：密钥 Key
    - `region` (string)：服务区域（可选）
  - `ollama` (object)：Ollama 配置
    - `endpoint` (string)：API 端点
    - `model` (string)：模型名称

**返回**：TranslationFeature 实例

**示例**：
```javascript
// Ollama 本地翻译（默认）
const translation = initTranslation('#preview', {
  service: 'ollama',
  quickView: true
});

// 腾讯翻译 API
const translation = initTranslation('#preview', {
  service: 'tencent',
  quickView: true,
  tencent: {
    secretId: 'YOUR_SECRET_ID',
    secretKey: 'YOUR_SECRET_KEY'
  }
});

// 关闭快速查看（显示中间按钮）
const translation = initTranslation('#preview', {
  service: 'ollama',
  quickView: false
});
```

---

## 性能与优化

### Ollama 性能优化

1. **模型大小**：选择合适的模型
   - 3B 参数：速度快，适合实时翻译
   - 7B 参数：质量高，适合长文本

2. **本地 GPU 加速**
   ```bash
   # 检查 GPU 是否可用
   ollama run llama3.2:3b
   ```

3. **减少上下文长度**
   当前限制为 5000 字符，适合段落级翻译

### 腾讯翻译优化

1. **请求频率**：避免短时间大量请求
2. **文本长度**：单次最长 2000 字符
3. **区域选择**：选择离用户最近的区域

---

## 隐私与安全

### Ollama 本地翻译
- ✅ 完全本地处理，不发送数据到服务器
- ✅ 模型存储在本地
- ✅ 无网络请求

### 腾讯翻译 API
- ⚠️ 文本会发送到腾讯云服务器处理
- ⚠️ 建议不要翻译敏感内容（如密码、私钥）
- ✅ HTTPS 加密传输
- ✅ 腾讯云数据安全认证

---

## 故障排除

### Ollama 连接失败

**问题**：选中文本后提示"Ollama 服务不可用"

**解决方案**：
1. 确认 Ollama 已安装：`ollama --version`
2. 启动服务：`ollama serve`
3. 检查端口：默认 11434
4. 确认模型已下载：`ollama list`
5. 测试模型：`ollama run llama3.2:3b "Hello"`

**常见错误**：
- `Connection refused`：Ollama 未启动，运行 `ollama serve`
- `Model not found`：模型未下载，运行 `ollama pull llama3.2:3b`

---

### 腾讯翻译 API 错误

**常见错误码**：

| 错误码 | 说明 | 解决方案 |
|--------|------|---------|
| `AuthFailure.SignatureFailure` | 签名错误 | 检查 SecretId/SecretKey 是否正确 |
| `FailedOperation.NoFreeAmount` | 免费额度用尽 | 查看控制台用量或充值 |
| `InvalidParameter` | 参数错误 | 检查文本长度（≤2000 字符） |
| `RequestLimitExceeded` | 请求过于频繁 | 降低请求频率 |

**调试方法**：
```javascript
// 临时启用详细日志
translationFeature.translateWithTencent = async function(text) {
  console.log('Translating:', text);
  try {
    const result = await originalTranslate.call(this, text);
    console.log('Result:', result);
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

---

## 使用建议

### 个人用户（推荐 Ollama）
- 优势：免费、离线、隐私
- 适合：日常阅读、学习文档
- 配置简单：`service: 'ollama'`

### 团队/企业（推荐腾讯 API）
- 优势：高质量、跨浏览器、无需本地安装
- 适合：多人协作、移动端访问
- 免费额度充足：500 万字符/月

### 混合使用
```javascript
// 根据环境自动选择
const service = window.location.hostname === 'localhost'
  ? 'ollama'      // 本地开发用 Ollama
  : 'tencent';    // 部署环境用腾讯

initTranslation('#preview', {
  service,
  quickView: true
});
```

---

## 高级功能

### 自定义 Ollama Prompt

为专业术语优化翻译质量：

```javascript
// 修改 translateWithOllama 的 prompt
translationFeature.translateWithOllama = async function(text) {
  const isChinese = /[一-龥]/.test(text);
  const prompt = isChinese
    ? `You are a technical translator. Translate the following Chinese technical text to English. Preserve technical terms like "API", "OAuth", "Markdown". Only output the translation:\n\n${text}`
    : `你是技术翻译专家。将以下英文技术文档翻译成中文。保留技术术语如 "API"、"OAuth"、"Markdown"。只输出翻译结果：\n\n${text}`;

  // ... 其余代码保持不变
};
```

### 翻译历史记录（待实现）

```javascript
// 保存翻译历史到 localStorage
class TranslationFeature {
  saveHistory(original, translated) {
    const history = JSON.parse(localStorage.getItem('translation-history') || '[]');
    history.unshift({ original, translated, timestamp: Date.now() });
    history.splice(10); // 只保留最近 10 条
    localStorage.setItem('translation-history', JSON.stringify(history));
  }
}
```

---

## 技术实现细节

### 快速查看模式

**交互流程**：
```
用户选中文本
    ↓
监听 mouseup 事件
    ↓
检查 quickView 配置
    ├─ true → 直接调用 translateSelection()
    └─ false → 显示工具提示按钮
    ↓
显示加载状态
    ↓
调用翻译 API
    ↓
渲染翻译卡片
```

### 腾讯云 API v3 签名

```javascript
// 签名算法（TC3-HMAC-SHA256）
const canonicalRequest = `${HTTPMethod}\n${CanonicalURI}\n${CanonicalQueryString}\n${CanonicalHeaders}\n${SignedHeaders}\n${HashedRequestPayload}`;

const stringToSign = `${Algorithm}\n${RequestTimestamp}\n${CredentialScope}\n${HashedCanonicalRequest}`;

const signature = HMAC-SHA256(secretSigning, stringToSign);
```

完整实现见 `translateWithTencent()` 方法。

---

## 未来扩展

计划中的功能：

1. **翻译历史记录**
   - LocalStorage 持久化
   - 快速查看历史翻译

2. **自定义词典**
   - 用户添加专业术语
   - 优先使用自定义翻译

3. **段落级翻译**
   - 双语对照阅读模式
   - 悬停段落显示翻译

4. **语音朗读**
   - Web Speech API
   - 中英文发音

5. **更多语言**
   - 日语、韩语、法语、德语
   - 自动语言检测

6. **更多翻译服务**
   - DeepL API
   - 有道翻译
   - Google Translate

---

## 许可协议

本翻译功能模块基于 MIT 协议开源。

## 支持与反馈

如有问题或建议，请提交 Issue 或 PR。
