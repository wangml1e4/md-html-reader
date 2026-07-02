# 翻译功能使用指南

## 功能概述

在 Markdown 预览器中新增中英文翻译功能，支持选中文本即时翻译。

## 使用方法

### 基本操作

1. **选中文本**：在预览区用鼠标选中要翻译的文本
2. **点击翻译按钮**：自动弹出翻译工具提示
3. **查看结果**：在弹出卡片中查看原文和译文
4. **复制译文**：点击"复制译文"按钮将结果复制到剪贴板

### 支持的翻译服务

#### 方案 1：Chrome 内置翻译 API（推荐）

**优势**：
- ✅ 完全离线，无需 API key
- ✅ 免费无限制
- ✅ 速度快，隐私安全

**要求**：
- Chrome 130+ 或 Edge 130+
- 需要下载语言模型（首次使用自动下载）

**配置**：
```javascript
initTranslation('#preview', {
  service: 'chrome-builtin'
});
```

#### 方案 2：百度翻译 API

**优势**：
- ✅ 翻译质量高
- ✅ 跨浏览器支持
- ✅ 免费额度：每月 5 万字符

**配置**：
```javascript
initTranslation('#preview', {
  service: 'baidu',
  baidu: {
    appid: 'YOUR_APP_ID',      // 在百度翻译开放平台申请
    key: 'YOUR_SECRET_KEY'      // https://fanyi-api.baidu.com
  }
});
```

**申请步骤**：
1. 注册百度账号
2. 访问 https://fanyi-api.baidu.com
3. 创建应用获取 APP ID 和密钥
4. 替换配置中的 appid 和 key

#### 方案 3：Ollama 本地翻译（高级用户）

**优势**：
- ✅ 完全本地，无隐私问题
- ✅ 可定制 prompt（专业术语）
- ✅ 免费

**要求**：
- 安装 Ollama：https://ollama.com/download
- 下载模型：`ollama pull llama3.2:3b`

**配置**：
```javascript
initTranslation('#preview', {
  service: 'ollama',
  ollama: {
    endpoint: 'http://localhost:11434/api/generate',
    model: 'llama3.2:3b'  // 或其他模型
  }
});
```

## 集成到现有页面

### Enhanced.html（已集成）

已在 `enhanced.html` 中完成集成，开箱即用。

### Editor.html 集成示例

```html
<!-- 1. 引入翻译模块 -->
<script src="translation-feature.js"></script>

<!-- 2. 在初始化代码中启用 -->
<script type="module">
  // ... 现有的 CodeMirror 初始化代码 ...

  window.addEventListener('load', () => {
    // 初始化翻译
    initTranslation('#preview', {
      service: 'chrome-builtin'
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
      service: 'chrome-builtin'
    });
  });
</script>
```

**注意**：翻译功能与评论系统的文本选择机制兼容，可以同时使用。

## API 参考

### initTranslation(selector, config)

初始化翻译功能。

**参数**：
- `selector` (string)：预览区的 CSS 选择器，默认 `'#preview'`
- `config` (object)：配置对象
  - `service` (string)：翻译服务类型
    - `'chrome-builtin'`：Chrome 内置 API
    - `'baidu'`：百度翻译 API
    - `'ollama'`：Ollama 本地翻译
  - `baidu` (object)：百度翻译配置
    - `appid` (string)：应用 ID
    - `key` (string)：密钥
  - `ollama` (object)：Ollama 配置
    - `endpoint` (string)：API 端点
    - `model` (string)：模型名称

**返回**：TranslationFeature 实例

**示例**：
```javascript
const translation = initTranslation('#preview', {
  service: 'chrome-builtin'
});
```

### TranslationFeature 类

手动创建翻译实例（高级用法）。

```javascript
const translation = new TranslationFeature('#preview');

// 修改配置
translation.config.service = 'baidu';
translation.config.baidu = {
  appid: 'YOUR_APP_ID',
  key: 'YOUR_KEY'
};
```

## 性能优化建议

1. **限制选中文本长度**：当前限制为 5000 字符，避免超长文本翻译
2. **缓存翻译结果**（未实现）：可扩展添加 localStorage 缓存
3. **批量翻译**（未实现）：可扩展支持段落级批量翻译

## 隐私与安全

### Chrome 内置 API
- ✅ 完全本地处理，不发送数据到服务器
- ✅ 语言模型存储在本地

### 百度翻译 API
- ⚠️ 文本会发送到百度服务器处理
- ⚠️ 建议不要翻译敏感内容
- ✅ HTTPS 加密传输

### Ollama 本地翻译
- ✅ 完全本地处理
- ✅ 无网络请求

## 故障排除

### Chrome Translation API 不可用

**问题**：点击翻译按钮后提示"浏览器不支持 Translation API"

**解决方案**：
1. 确认 Chrome 版本 ≥ 130
2. 访问 `chrome://flags/#translation-api` 启用 Translation API
3. 重启浏览器
4. 或改用百度/Ollama 翻译

### 百度翻译 API 错误

**常见错误码**：
- `52001`：请求超时，请重试
- `52003`：未授权用户（检查 appid/key）
- `54003`：访问频率受限（免费版 QPS=1）
- `54004`：账户余额不足

**解决方案**：
- 检查 appid 和 key 是否正确
- 确认账户有余额或在免费额度内
- 降低请求频率

### Ollama 连接失败

**问题**：提示"Ollama 服务不可用"

**解决方案**：
1. 确认 Ollama 已安装并运行：`ollama serve`
2. 检查端口是否正确（默认 11434）
3. 确认模型已下载：`ollama list`
4. 如果使用远程 Ollama，修改 endpoint

## 未来扩展

### 计划中的功能

1. **翻译历史记录**
   - 保存最近翻译的 10 条记录
   - 支持快速查看历史翻译

2. **自定义词典**
   - 支持用户添加专业术语对照
   - 优先使用自定义翻译

3. **段落级翻译**
   - 支持双语对照阅读模式
   - 悬停段落显示翻译

4. **语音朗读**
   - 集成 Web Speech API
   - 支持中英文朗读

5. **更多语言支持**
   - 日语、韩语、法语等
   - 多语言自动检测

### 贡献代码

欢迎提交 PR 扩展翻译功能：
- 添加新的翻译服务（如有道、腾讯、DeepL）
- 改进 UI/UX
- 优化翻译质量
- 修复 bug

## 技术实现细节

### 架构设计

```
TranslationFeature (主类)
├── 文本选择监听器
├── 工具提示展示
├── 翻译服务抽象层
│   ├── translateWithChrome()
│   ├── translateWithBaidu()
│   └── translateWithOllama()
└── 结果卡片渲染
```

### 关键代码片段

**语言检测**：
```javascript
const isChinese = /[一-龥]/.test(text);
const targetLang = isChinese ? 'en' : 'zh';
```

**HTML 转义**（安全）：
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

**百度翻译签名**：
```javascript
const sign = await crypto.subtle.digest('MD5',
  new TextEncoder().encode(appid + text + salt + key)
);
```

## 许可协议

本翻译功能模块基于 MIT 协议开源。

## 支持与反馈

如有问题或建议，请提交 Issue。
