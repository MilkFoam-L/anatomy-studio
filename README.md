# Anatomy Studio

把一个概念，造成一台会动的机器。

Anatomy Studio 是一个**纯静态网页**。它把开源的 [Anatomy skill](https://github.com/wheresryan22/anatomy) 搬进浏览器：填入你自己的 Claude API Key 和接口地址（官方或任意中转站），描述想解释的概念，就能得到一张可交互的等距（isometric）机械图解。整个过程像“一键生图”，但背后跑的是完整的 skill 工作流：构思物件、写几何、构建、几何审计、截图自检、修正。

> English: a static web studio that runs the Anatomy skill entirely in your browser, with your own Claude API key and endpoint. No backend.

## 特点

- **零后端**：部署到 GitHub Pages、Cloudflare Pages 或任何静态托管即可。请求从浏览器直接发往你填写的接口。
- **自带接口**：支持 Anthropic Messages 协议（`/v1/messages`，推荐）和 OpenAI 兼容协议（`/v1/chat/completions`）。两个协议的地址、Key、模型分开保存，切换互不覆盖；可以从接口拉取模型列表。
- **skill 原样运行**：`SKILL.md` 原文作为系统提示词，`node build.mjs`、`--audit` 几何审计都在浏览器里真实执行。构建结果与本地 Node 逐字节一致（有 E2E 测试保证）。
- **浏览器内自检**：skill 用 headless Chrome 做的 `capture.mjs` / `drive.mjs` / `lines.mjs`，在这里改成浏览器标签页内渲染和截图，参数和动作保持一致，截图会回传给模型。
- **安全隔离**：生成的代码只在无源（opaque origin）沙箱 iframe / Worker 中运行，读不到你的 API Key，也不能联网。
- **继续修改**：图生成后可以直接提修改意见，在同一个上下文和工作区里接着改，就像生图的「再改改」。
- **断了不丢**：接口中途失败或手动停止时，保留当前做到的最新页面，可预览、下载或「继续」。
- **本地历史**：生成的图解保存在浏览器 IndexedDB，可以重新打开、下载 HTML/SVG 和构建脚本。

## 工作原理

```
浏览器（静态站）
├─ Agent 循环 ─────────── 调你的接口（/v1/messages 或 /v1/chat/completions，流式、自动重试）
│   system = 适配说明 + SKILL.md        tools = read/write/edit/list/grep/run/finish
│
├─ run "node work/x/build.mjs --light"
│   └─ 沙箱 iframe（opaque origin, CSP connect-src 'none'）
│       └─ Web Worker：虚拟文件系统 + node:fs/path/url 替身，import 改写为 blob URL，真实执行
│
├─ run "node scripts/capture.mjs page.html --hover 0.7,0.5"
│   └─ 检查台 iframe（opaque origin）+ 注入 agent：慢放时钟、合成指针/键盘事件、DOM 截图、线端检查
│
└─ 结果：沙箱 iframe 预览、下载、存入 IndexedDB
```

关键目录：

| 路径 | 作用 |
|---|---|
| `vendor/anatomy` | skill 本体（git submodule），构建时打包成浏览器可读的只读文件系统 |
| `src/runtime/` | 虚拟文件系统、shell 解析、Node 运行时 Worker、文本工具（grep/head/sed…） |
| `src/stage/` | 检查台：截图/驱动/线端检查的浏览器实现 |
| `src/llm/` | Anthropic / OpenAI 兼容协议、SSE 解析、重试 |
| `src/agent/` | 系统提示词、工具定义、Agent 循环、上下文压缩 |
| `src/components/` | 界面（shadcn/ui + Tailwind） |

## 本地开发

需要 Node 22+。

```sh
git clone --recurse-submodules <this repo>
cd anatomy-studio
npm install
npm run dev          # 打包 skill + 构建沙箱运行时 + 启动 Vite
```

打开页面后点右上角「设置接口」，填写接口地址、API Key 和模型。

```sh
npm test             # 单元测试
npm run test:e2e     # 浏览器运行时 E2E：构建一致性、审计、截图
npm run build        # 生产构建到 dist/
```

真实接口的端到端测试（会消耗额度，默认不跑）：

```sh
ANATOMY_BASE_URL=https://your-endpoint ANATOMY_API_KEY=sk-... npx playwright test live/job
```

## 部署

`npm run build` 产物在 `dist/`，是纯静态文件。部署到子路径时设置 `BASE_PATH`：

```sh
BASE_PATH=/anatomy-studio/ npm run build
```

仓库自带 `.github/workflows/deploy.yml`，推到 `main` 即发布到 GitHub Pages。

## 关于中转站

浏览器直连要求接口允许跨域（CORS）。

- **官方 `api.anthropic.com`**：自动带上 `anthropic-dangerous-direct-browser-access` 头。
- **中转站**：只发送 `x-api-key` / `Authorization` 和 `content-type` 三个常见放行的请求头，不发 `anthropic-version`（多数中转站会在上游自动补上）。
- **不稳定的中转站**：504/502、断流会自动重试（最多 6 次，指数退避到 60 秒）；有的中转站会缓冲整段回复再返回，所以每轮可能好几分钟没有动静，页面会显示「模型思考中 · 已等待」。
- **如果中转站不允许跨域**：「测试连接」会提示 CORS 错误。这种情况需要中转站开启 CORS，或者你自己在前面加一层反向代理。

## 限制

- 只输出独立 HTML 页面或 SVG 文件；skill 的 React/Next.js 组件输出、PDF 打印、社区发布、3D 的 `turn-check` 不可用。
- 合成的指针事件不会触发 CSS `:hover`（skill 自带示例用 JS 处理指针，不受影响）。
- 截图是基于 DOM 渲染的，个别网络字体可能用回退字体显示。
- 一张图要几十轮模型调用。实测（Opus 5.5，经一个约 70 tok/s、非真流式的中转站）：快速档约 30 轮、30–40 分钟，第 5–6 轮出第一版。标准、精细档成比例更久，token 消耗也更大。想更快可以在设置里调低「思考强度」或换 Sonnet，代价是细节变少。

## 致谢与许可

图解能力全部来自 [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy)（MIT）。本项目以 MIT 许可发布，见 [LICENSE](LICENSE)。本项目不是 Anatomy 的官方站点。
