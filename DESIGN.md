---
version: alpha
name: Drafting Table
description: 通用的「制图桌」设计系统。暖白图纸、石墨墨线、唯一的朱红信号色、工程图纸式标注。适用于工具类、生成类、数据/工程类 Web 应用，与具体项目无关。
colors:
  # 亮色（默认）。源值为 OKLCH（见文末 Implementation），此处为换算后的 sRGB。
  primary: "#1A1916"
  on-primary: "#F7F7F4"
  signal: "#E04F1A"
  on-signal: "#FCFCF9"
  background: "#F4F2EE"
  paper: "#FAF9F6"
  popover: "#FCFCF9"
  ink: "#181714"
  ink-soft: "#44423E"
  muted: "#EBE9E5"
  muted-ink: "#65635D"
  secondary: "#E7E6E1"
  border: "#D7D6D0"
  input: "#D3D1CA"
  destructive: "#D02C2A"
  grid-line: "#1817140B"
  # 暗色：同一套角色的另一组取值，切到暗色主题时替换上面的同名角色。
  dark-primary: "#E9E8E3"
  dark-on-primary: "#151411"
  dark-signal: "#F3743F"
  dark-background: "#11100F"
  dark-paper: "#181715"
  dark-ink: "#E9E8E3"
  dark-ink-soft: "#B9B7B2"
  dark-muted: "#21201E"
  dark-muted-ink: "#97958E"
  dark-secondary: "#252421"
  dark-border: "#FFFFFF1C"
  dark-destructive: "#F75D59"
typography:
  display:
    fontFamily: Geist Variable, PingFang SC, Microsoft YaHei, sans-serif
    fontSize: 2.6rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.025em
  title:
    fontFamily: Geist Variable, PingFang SC, Microsoft YaHei, sans-serif
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Geist Variable, PingFang SC, Microsoft YaHei, sans-serif
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.65
  body-sm:
    fontFamily: Geist Variable, PingFang SC, Microsoft YaHei, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: Geist Variable, PingFang SC, Microsoft YaHei, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: IBM Plex Mono, ui-monospace, monospace
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.14em
  mono:
    fontFamily: IBM Plex Mono, ui-monospace, monospace
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: '"tnum" 1'
  mono-sm:
    fontFamily: IBM Plex Mono, ui-monospace, monospace
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: '"tnum" 1'
rounded:
  sm: 4px
  md: 5px
  lg: 6px
  xl: 9px
  plate: 10px
  full: 9999px
spacing:
  grid: 32px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 20px
  xl: 24px
  section: 56px
  gutter: 16px
  gutter-wide: 24px
  container: 1280px
  sidebar: 420px
components:
  plate:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: 20px
  plate-primary:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.plate}"
    padding: 24px
  label-caps:
    textColor: "{colors.muted-ink}"
    typography: "{typography.label-caps}"
  readout:
    textColor: "{colors.muted-ink}"
    typography: "{typography.mono-sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    height: 36px
    padding: 10px
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: 32px
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    height: 36px
  textarea:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
  segmented:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: 2px
  segmented-item:
    textColor: "{colors.muted-ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    height: 28px
    padding: 12px
  segmented-item-pressed:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  chip:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted-ink}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.full}"
    padding: 10px
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px
  list-row-hover:
    backgroundColor: "{colors.muted}"
  list-row-icon:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.sm}"
    size: 24px
  list-row-icon-active:
    textColor: "{colors.signal}"
  code-block:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.md}"
    padding: 12px
  preview-frame:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.sm}"
  progress-bar:
    backgroundColor: "{colors.primary}"
    height: 2px
  status-dot-live:
    backgroundColor: "{colors.signal}"
    size: 8px
  badge-signal:
    textColor: "{colors.signal}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
  partner-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 12px
  banner-warning:
    textColor: "{colors.signal}"
    rounded: "{rounded.md}"
    padding: 12px
  banner-error:
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    padding: 12px
  dialog:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
---

# Drafting Table

一套与具体项目无关的通用设计系统。任何项目都可以把本文件放到仓库根目录，作为界面实现与 AI 代理生成 UI 的依据；项目自己的业务组件按下面的通用模式组合即可。

## Overview

界面是一张**制图桌**：桌面是纸，内容压在一块块图版（plate）上，用墨线书写，只有「活的东西」用一支朱红笔标出来。外壳的职责是安静地托住内容——图、数据、代码、生成结果——而不是自己抢戏。

三个关键词：

- **图纸（Paper）**：暖白纸色背景、32px 淡网格、卡片像压在桌上的图版，重要的那张四角有制图角标（corner ticks）。
- **墨线（Ink）**：文字与控件几乎全是石墨色的不同明度；层级靠明度、字号和留白拉开，不靠颜色。
- **信号（Signal）**：全站唯一的彩色——朱红。它只表示「正在发生」「需要注意」「这里是重点」。

气质参考工程制图与仪器面板：等宽小号大写标签（`FIG. 1 · 概览`）、等宽 tabular 数字读数、像拨档开关的分段控件、发丝线分隔。适合工具、生成器、控制台、开发者产品、数据看板、文档站；不适合需要强烈品牌色、儿童或娱乐向的产品。

中英文混排友好：正文以中文为主，英文专有名词、数字、路径、命令一律等宽。

## Colors

色板只有三类：暖灰纸（色相约 90–95°、极低彩度）、石墨墨、一支朱红笔。所有颜色以**角色**命名，亮色与暗色是同一组角色的两种取值，组件只引用角色，绝不写死色值。

- **primary（石墨 #1A1916）**：主按钮、分段控件选中态、进度条。它是「墨」，不是品牌色；暗色下反转为纸色。
- **signal（朱红 #E04F1A，暗色 #F3743F）**：唯一的强调色。用于运行/加载中的状态点与旋转图标、焦点环、标题中的一个强调词、合作/推荐标记（以 30% 描边 + 5% 底色出现）。
- **background / paper**：页面用 `background`（略深的纸），图版用 `paper`（更白的纸），一级明度差就足以表达「纸压在桌上」。
- **ink / ink-soft / muted-ink**：三级墨色——正文、次要说明、标签与元信息。不要引入第四级灰。
- **muted / secondary**：输入区、悬停底、代码块底等「凹下去」的面。
- **border / input**：发丝线。暗色下改为白色 11% / 16% 透明，而不是实色灰。
- **destructive（#D02C2A）**：只用于失败、删除与不可逆操作；以 5–10% 透明底 + 实色文字出现，不做大面积红块。
- **grid-line**：墨色约 4.5%（暗色为白 3.5%），32px 一格，几乎看不见但能感到纸面。

如果项目有自己的品牌色，**只替换 `signal`**，并保证它在两种主题下与 `paper` 的对比度 ≥ 3:1（用于图形与大字）；其余角色保持中性。

## Typography

两种字体，一种负责说话，一种负责标注：

- **Geist Variable**（中文回退 PingFang SC / Microsoft YaHei）：标题与正文。
- **IBM Plex Mono**：标签、参数、路径、命令、时间、计数，全部开启等宽数字（`tnum`）。

层级：

- **display**：页面主标题，600 字重、1.1 行高、轻微负字距，最多两行，可用 signal 色强调其中一个词。
- **title**：区块标题。
- **body / body-sm**：说明文字 15px，表单、列表与密集信息 14px，行高 ≥ 1.6，照顾中文。
- **caption**：辅助说明、表单提示、页脚。
- **label-caps**：11px 等宽、全大写、0.14em 字距、muted-ink 色。这是本风格的签名——每张图版的左上角都应有一个，像图纸的图号：`工作日志`、`预览 · 实时`、`FIG. 0 · 新建`。
- **mono / mono-sm**：命令行、文件路径、模型或资源名、读数（`7:25 · 第 27/30 轮 · ↑2.04M ↓26.9k`）。

不使用斜体，不引入第三种字体，不用下划线或彩色表达层级（链接除外）。

## Layout

- **网格**：页面背景 32px 方格；间距取 4px 基数（4 / 8 / 12 / 20 / 24），大区块之间 56px。
- **容器**：最大宽 1280px，左右留白手机 16px、平板以上 24px。
- **主从双栏**（≥1024px）：左栏 420px 放标题与主输入图版，右栏自适应放工作区/预览/结果。**两栏上下边必须对齐**：右栏卡片高度跟随左栏，内容超出时在卡片内部滚动，不把卡片撑高；左栏在长页面中 sticky 于顶栏下方。
- **工作区分屏**：过程类界面左右平分为「过程（列表/日志）」与「结果（预览）」，中间一条发丝分隔线；完成后可收为单栏结果 + 底部操作条。
- **窄屏**（<1024px）：单列堆叠，预览区限制在 `min(70vh, 520px)` 高；任何宽度下都不允许横向滚动（至少验证 320 / 390 / 768 / 1440）。
- **首屏即工具**：第一屏直接是可用功能或核心内容，不做营销式 hero。

## Elevation & Depth

深度只有三层，像桌面上的纸：

1. **桌面**：`background` + 网格，无阴影。
2. **图版（plate）**：`paper` 底 + 1px 发丝边 + 一组很轻的阴影——顶部 1px 内高光（白 60%）、1–2px 贴地阴影（墨 6%）、一条 32px 模糊的长投影（墨 18%，向下偏移、负扩散）。暗色下去掉高光，长投影加深到黑 60%。
3. **浮层**（弹窗、下拉、大图查看）：`popover` 底，叠在半透明遮罩上。

图版内部的再分层（列表行、代码块、输入框）不用阴影，只用 `background` / `muted` 与 `paper` 的一级明度差或发丝边。

## Shapes

- 基础圆角约 6px，整体偏方——这是图纸，不是气泡。
- 图版 10px，弹窗 9px，按钮/输入框 6px，分段控件与列表行 5px，图标格与缩略图 4px。
- 只有标签类小物件用胶囊（`full`）：示例 chips、状态/推荐徽标。按钮不做胶囊。
- **制图角标**：页面中最重要的一张图版（通常是主输入区）四角各一个 10px 的 L 形发丝线，内缩 10px。这是除网格外唯一允许的装饰，一页只用一次。
- 图标统一线性图标（推荐 lucide），14–16px，描边与所在文字同色。

## Components

以下是与业务无关的通用模式，项目组件应由它们组合而成。

- **Plate（图版）**：所有一级容器。左上 `label-caps` 标签，右上可选元信息或次要操作，内容 20px 内边距。
- **Primary plate（主输入图版）**：带制图角标。结构自上而下：`label-caps` 头（左图号、右来源）→ 一句粗体引导语 → 大号文本框（`muted` 底）→ 胶囊 chips 作示例 → 发丝分隔线 → 若干行「标签 + 分段控件」参数 → 底部左侧等宽提示（预估、快捷键 `⌘ ↵`）、右侧唯一主按钮。执行中主按钮变为「■ 停止」。
- **Segmented（分段控件）**：两到四个互斥选项一律用它，不用下拉框。外框发丝边、2px 内衬，选中项石墨底纸色字，未选中 muted-ink，等宽字。左侧 `label-caps` 标签，整行两端对齐。
- **Button**：primary 用于每屏唯一的主操作；outline 用于并列次操作；ghost 用于行内小操作；destructive 只用于删除。禁用 50% 透明，按下下沉 1px。
- **List row（过程/活动行）**：24px 方形图标格 + 动作名 + 截断的等宽详情 + 状态（✓ / ✗ / 数值）+ 可展开箭头，展开为 code block。进行中：图标格描边与图标变 signal 并旋转。可在行下附 80px 高缩略图，悬停上浮 1px。自然语言说明直接作为正文段落插入列表。
- **Preview frame（实时预览）**：等比缩放显示被预览的内容，下方附等宽来源路径或时间戳。内容更新时旧画面保持到新画面就绪，不闪白、不塌高。
- **Readout bar（读数顶栏）**：左侧状态 `label-caps`（进行中 / 完成 / 已停止），中间标题截断，右侧等宽读数（耗时 · 进度 · 用量）。下方 2px 进度条。
- **Status dot（状态点）**：8px 实心 signal 点 + 一圈 ping 动画，表示等待或运行中，旁边写清在等什么、等了多久。
- **Chip**：胶囊、发丝边、等宽小字，用于示例输入或筛选；悬停时描边与文字加深。
- **Partner / promo card（合作推荐卡）**：signal 30% 描边、5% 底，左侧 28px logo（白底圆角），名称 + signal 胶囊徽标 + 右侧 outline 小按钮「了解 ↗」，下面一行粗标语与两行 muted 说明。外链加 `rel="noopener noreferrer sponsored"`。
- **Banner**：失败用 destructive 5% 底 + 30% 描边；部分成功/可恢复用 signal 10% 底；始终给出明确的下一步（「继续」「重试」）。
- **Dialog**：`popover` 底、9px 圆角，标题 + 一句 muted 说明，表单字段纵向排列，每个字段下有 caption 级提示；底部右对齐「次操作 / 主操作」。
- **Toast**：右下角，简短一句话，成功与失败两种语气。
- **Empty / loading / error**：每个容器都要有这三种自然状态，用 muted-ink 的一句话说明，而不是空白。

## Do's and Don'ts

- **Do** 让内容（图、数据、结果）成为页面最显眼的东西；外壳一律中性。
- **Do** 每屏只用一个 primary 按钮；signal 色每屏只出现在一两处「活的」位置。
- **Do** 给每张图版一个 `label-caps` 标签；读数、路径、命令一律等宽 + tabular 数字。
- **Do** 主从双栏保持上下边对齐，长内容在卡片内部滚动。
- **Do** 亮色、暗色都按角色取色，两套都要截图检查；尊重 `prefers-reduced-motion`。
- **Do** 所有交互可键盘操作，焦点环用 signal 色，图标按钮有可访问名称。
- **Do** 实时更新的界面按帧合并渲染，避免高频重绘导致闪动。
- **Don't** 引入第二种强调色、渐变、玻璃拟态或大面积色块（第三方 logo 自带的颜色除外）。
- **Don't** 用阴影表达卡片内部层级，也不要叠两层以上的阴影卡片。
- **Don't** 用下拉框替代两到四个选项的分段控件。
- **Don't** 使用大于 10px 的圆角，或把按钮做成胶囊。
- **Don't** 在更新时让界面闪烁或跳动：不整块替换、不先删后加、不让高度随内容塌陷。
- **Don't** 用 emoji 或插画装饰界面；装饰只有网格和制图角标。

## Implementation

把下面的变量放进项目的全局样式即可复用本系统（示例为 Tailwind v4 + shadcn/ui 命名，其他技术栈按角色名映射）。

```css
:root {
  --background: oklch(0.962 0.006 95);
  --paper: oklch(0.982 0.004 95);
  --popover: oklch(0.99 0.003 95);
  --foreground: oklch(0.205 0.006 90);   /* ink */
  --ink-soft: oklch(0.38 0.008 90);
  --primary: oklch(0.215 0.006 90);
  --primary-foreground: oklch(0.975 0.004 95);
  --secondary: oklch(0.925 0.007 95);
  --muted: oklch(0.935 0.006 95);
  --muted-foreground: oklch(0.5 0.01 90);  /* muted-ink */
  --destructive: oklch(0.56 0.2 27);
  --signal: oklch(0.62 0.19 38);
  --border: oklch(0.875 0.008 95);
  --input: oklch(0.86 0.009 95);
  --ring: var(--signal);
  --radius: 0.4rem;
  --grid-line: oklch(0.205 0.006 90 / 4.5%);
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
.dark {
  --background: oklch(0.175 0.004 90);
  --paper: oklch(0.205 0.005 90);
  --popover: oklch(0.225 0.005 90);
  --foreground: oklch(0.93 0.006 95);
  --ink-soft: oklch(0.78 0.008 95);
  --primary: oklch(0.93 0.006 95);
  --primary-foreground: oklch(0.19 0.005 90);
  --secondary: oklch(0.26 0.005 90);
  --muted: oklch(0.245 0.005 90);
  --muted-foreground: oklch(0.67 0.01 95);
  --destructive: oklch(0.68 0.19 25);
  --signal: oklch(0.7 0.17 42);
  --border: oklch(1 0 0 / 11%);
  --input: oklch(1 0 0 / 16%);
  --grid-line: oklch(1 0 0 / 3.5%);
}

body {
  background-color: var(--background);
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 32px 32px;
  background-position: -1px -1px;
}

.label-caps {
  font: 400 11px/1.4 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--muted-foreground);
}

.plate {
  position: relative;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) * 1.6);
  background: var(--paper);
  box-shadow:
    0 1px 0 oklch(1 0 0 / 60%) inset,
    0 1px 2px oklch(0.2 0.01 90 / 6%),
    0 12px 32px -16px oklch(0.2 0.01 90 / 18%);
}
.dark .plate {
  box-shadow: 0 1px 0 oklch(1 0 0 / 5%) inset, 0 16px 40px -20px oklch(0 0 0 / 60%);
}

/* 制图角标：一页只用在最重要的那张图版上 */
.corner-ticks::before,
.corner-ticks::after {
  content: "";
  position: absolute;
  inset: 10px;
  pointer-events: none;
}
.corner-ticks::before {
  background:
    linear-gradient(var(--border), var(--border)) left top / 10px 1px no-repeat,
    linear-gradient(var(--border), var(--border)) left top / 1px 10px no-repeat,
    linear-gradient(var(--border), var(--border)) right top / 10px 1px no-repeat,
    linear-gradient(var(--border), var(--border)) right top / 1px 10px no-repeat;
}
.corner-ticks::after {
  background:
    linear-gradient(var(--border), var(--border)) left bottom / 10px 1px no-repeat,
    linear-gradient(var(--border), var(--border)) left bottom / 1px 10px no-repeat,
    linear-gradient(var(--border), var(--border)) right bottom / 10px 1px no-repeat,
    linear-gradient(var(--border), var(--border)) right bottom / 1px 10px no-repeat;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

字体依赖：`@fontsource-variable/geist`、`@fontsource/ibm-plex-mono`（400 / 500）。
