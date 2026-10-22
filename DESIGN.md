---
version: alpha
name: Anatomy Studio · Drafting Table
description: 制图桌风格。暖白图纸、石墨墨线、唯一的朱红信号色，配合工程图纸式的标注与网格。
colors:
  # 亮色（默认）。源值为 OKLCH，见 src/index.css；此处为换算后的 sRGB。
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
  # 暗色：同一套角色，切换 .dark 时生效。
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
  dark-stage: "#161614"
typography:
  display:
    fontFamily: Geist Variable, PingFang SC, sans-serif
    fontSize: 2.6rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.025em
  title:
    fontFamily: Geist Variable, PingFang SC, sans-serif
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Geist Variable, PingFang SC, sans-serif
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.65
  body-sm:
    fontFamily: Geist Variable, PingFang SC, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: Geist Variable, PingFang SC, sans-serif
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
  gutter-sm: 24px
  container: 1280px
  composer: 420px
components:
  plate:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
  composer:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.plate}"
    padding: 24px
    width: "{spacing.composer}"
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
  segmented:
    backgroundColor: "{colors.background}"
    typography: "{typography.mono}"
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
  label-caps:
    textColor: "{colors.muted-ink}"
    typography: "{typography.label-caps}"
  log-row:
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px
  log-row-hover:
    backgroundColor: "{colors.muted}"
  log-row-icon:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.sm}"
    size: 24px
  log-row-icon-active:
    textColor: "{colors.signal}"
  stage:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.sm}"
  stage-dark:
    backgroundColor: "{colors.dark-stage}"
  progress-bar:
    backgroundColor: "{colors.primary}"
    height: 2px
  status-dot-live:
    backgroundColor: "{colors.signal}"
    size: 8px
  sponsor-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 12px
  sponsor-badge:
    textColor: "{colors.signal}"
    rounded: "{rounded.full}"
  error-banner:
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    padding: 12px
---

# Anatomy Studio · Drafting Table

## Overview

Anatomy Studio 的界面是一张**制图桌**：用户在左边「填图签」（描述概念与参数），右边是图纸台，机器在上面被一步步画出来、检查、交付。界面的职责是安静地托住图解本身——图解是等距（isometric）线稿，细线、留白、单色为主，所以外壳也必须克制，不能和图抢戏。

三个关键词：

- **图纸（Paper）**：暖白纸色背景、32px 淡网格、卡片像压在桌上的图版（plate），四角有制图标记（corner ticks）。
- **墨线（Ink）**：几乎所有文字与控件都是石墨色的不同明度，层级靠明度和字号拉开，而不是靠颜色。
- **信号（Signal）**：全站只有一种彩色——朱红。它只表示「活的」「正在发生」「请看这里」：运行中的进度、焦点环、强调词、赞助标记。

气质上参考工程制图与仪器面板：等宽小号大写标签（`FIG. 0 · 新建图解`）、tabular 数字计时器、像拨档开关一样的分段控件。中文与英文混排，中文正文为主，英文/数字/路径一律等宽。

## Colors

色板来自制图桌：暖灰纸（色相约 90–95°，极低彩度）、石墨墨、一支朱红笔。源值写在 `src/index.css` 的 OKLCH 变量里，front matter 中是换算后的 sRGB。

- **primary（石墨 #1A1916）**：主按钮、分段控件选中态、进度条。它是「墨」，不是品牌色。
- **signal（朱红 #E04F1A）**：唯一的强调色。用于运行中的状态点与旋转图标、焦点环（`ring`）、标题里的「会动的机器」、赞助徽标与卡片描边（30% 透明度）。暗色下提亮为 #F3743F。
- **background / paper**：页面是 `background`（略深的纸），卡片是 `paper`（更白的纸），一层之差就够表达「图版压在桌上」。
- **ink / ink-soft / muted-ink**：三级墨色——正文、次要说明、标签与元信息。不要再引入第四级灰。
- **border / input**：发丝线。暗色下改为白色 11% / 16% 透明，而不是实色灰。
- **destructive（#D02C2A）**：只用于失败与删除；以 5–10% 透明底色 + 实色文字出现，不做大面积红块。
- **grid-line**：墨色 4.5%（暗色为白 3.5%），32px 一格，几乎看不见但能感到纸面。
- **dark-stage（#161614）**：生成暗色图解时检查台的底色，和图解自身暗色背景保持一致。

亮/暗两套是**同一组角色**的两种取值，组件只引用角色，不写死颜色。

## Typography

两种字体，一种负责说话，一种负责标注：

- **Geist Variable**（中文回退 PingFang SC / 微软雅黑）：标题与正文。
- **IBM Plex Mono**：标签、参数、路径、命令、计时与 token 计数，全部开启等宽数字。

层级：

- **display**：首屏标题「把一个概念，造成一台会动的机器。」，600 字重、1.1 行高、轻微负字距，最多两行，强调词用 signal 色。
- **title**：区块标题（画廊、我的图解）。
- **body / body-sm**：说明文字 15px，日志与表单 14px，行高 1.6 以上，照顾中文。
- **label-caps**：11px 等宽、全大写、0.14em 字距，muted-ink 色。它是本风格的签名——每张图版的左上角都应有一个，比如 `工作日志`、`检查台 · 实时`、`示例 · DIAL INDICATOR`。
- **mono / mono-sm**：命令行、文件路径、模型名、`7:25 · 第 27/30 轮 · ↑2.04M ↓26.9k` 这类读数。

不使用斜体，不使用第三种字体，不用字重之外的手段（下划线、彩色）表达层级。

## Layout

- **网格**：页面背景是 32px 方格；间距取 4px 基数（4 / 8 / 12 / 20 / 24），区块之间 56px。
- **容器**：最大宽 1280px，左右留白手机 16px、平板以上 24px。
- **首屏双栏**（≥1024px）：左栏 420px 放标题与 Composer，右栏自适应放工作台/示例。**两栏上下边必须对齐**：右侧卡片高度跟随左栏，内容超出时在卡片内部滚动，不把卡片撑高。左栏在长页面中 sticky 于顶栏下方。
- **工作台**：运行中左右平分为「工作日志」和「检查台」，中间一条发丝分隔线；完成后变为单栏结果预览 + 操作条。
- **窄屏**（<1024px）：所有区块单列堆叠，示例与预览限制在 `min(70vh, 520px)` 高；任何宽度下都不允许横向滚动（有 E2E 覆盖 320 / 390 / 768 / 1440）。
- 首屏直接是可用的工具，不做营销式 landing。

## Elevation & Depth

深度只有三层，像桌面上的纸：

1. **桌面**：`background` + 网格，无阴影。
2. **图版（plate）**：`paper` 底色 + 1px 发丝边 + 一组很轻的阴影——顶部 1px 内高光（白 60%）、1–2px 贴地阴影、一条 32px 模糊的长投影（墨色 18%，向下偏移）。暗色下去掉高光，加深长投影。
3. **浮层**（弹窗、下拉、截图大图）：`popover` 底色，叠在半透明遮罩上。

层内的再分层（日志行、代码块、输入框）不用阴影，只用 `background` 与 `paper` 的一级明度差或发丝边。

## Shapes

- 基础圆角 0.4rem（约 6px），整体偏方——这是图纸，不是气泡。
- 图版 10px，按钮/输入框 6px，分段控件与日志行 5px，图标格与截图 4px。
- 只有标签类小物件用胶囊（`full`）：示例提示词 chips、赞助徽标。
- **制图角标**：主要输入图版（Composer）四角各一个 10px 的 L 形发丝线，内缩 10px。这是装饰里唯一允许的元素，用在最重要的一张卡片上，不要到处加。
- 图标统一 lucide 线性图标，14–16px，描边与正文同色。

## Components

- **Plate**：所有一级容器。左上 `label-caps` 标签、右上可选元信息，内容从 20px 内边距开始。
- **Composer**：带角标的图版。顶部 `FIG. 0 · 新建图解` / `ANATOMY SKILL`，一句粗体引导语，大号文本框（`muted` 底），下方胶囊 chips 作提示词示例，发丝分隔线后是三行参数（主题 / 输出 / 精度），底部左侧是等宽的预估时长与快捷键 `⌘ ↵`，右侧主按钮。运行中主按钮变为「■ 停止」。
- **Segmented**：参数选择一律用分段控件而不是下拉框。外框发丝边，选中项石墨底白字，未选中为 muted-ink，等宽字。左侧配 `label-caps` 标签，整行两端对齐。
- **Button**：primary 用于每屏唯一的主操作（生成图解、保存、下载）；outline 用于并列次操作（新标签打开、测试连接）；ghost 用于行内小操作（获取列表）。禁用态 50% 透明，按下下沉 1px。
- **Run log row**：24px 方形图标格 + 动作名（构建 / 运行 / 截图检查 / 修改）+ 截断的等宽命令 + 状态（✓ / ✗ / 写入字节数）+ 可展开箭头。执行中的行：图标格描边与图标变 signal 色并旋转。截图检查行下方附 80px 高的缩略图，悬停上浮 1px。模型的自然语言输出直接作为正文段落插在日志里。
- **Stage（检查台）**：实时显示被检查页面的等比缩放画面，下方是最近一张截图与等宽文件路径。换页时旧画面保持到新画面就绪，不闪白；截图解码完成后再替换。
- **Header readout**：工作台顶栏左侧状态 `label-caps`（工作中 / 完成 / 已停止），中间任务标题截断，右侧等宽读数（耗时 · 轮数 · token）。其下 2px 进度条。
- **Status dot**：8px 实心 signal 点，外加一圈 ping 动画，表示「模型思考中 · 已等待 m:ss」。
- **Sponsor card**：signal 30% 描边、5% 底色的卡片，左侧 28px logo（白底圆角），名称 + 「赞助」胶囊徽标 + 右侧 outline 小按钮「获取 API Key ↗」，下面一行粗标语和两行 muted 说明。页脚有同款 16px logo 的文字链接。
- **Error / partial banner**：失败用 destructive 5% 底 + 30% 描边；「未完成但已有页面」用 signal 10% 底，并总是给出「继续」「重新开始」两个出口。
- **Toast**：右下角，简短中文一句话，成功/失败各一种语气。

## Do's and Don'ts

- **Do** 让图解成为页面上最显眼的东西；外壳一律中性。
- **Do** 每屏只用一个 primary 按钮；signal 色每屏只出现在一两处「活的」位置。
- **Do** 给每张图版一个 `label-caps` 标签，读数、路径、命令一律等宽 + tabular 数字。
- **Do** 保持左右栏上下边对齐，长内容在卡片内部滚动。
- **Do** 亮色、暗色都按角色取色，两套都要截图检查；尊重 `prefers-reduced-motion`。
- **Do** 所有交互可键盘操作，焦点环用 signal 色，图标按钮必须有可访问名称。
- **Don't** 引入第二种强调色、渐变、玻璃拟态或大面积色块（赞助商 logo 本身的渐变除外，且只出现在 logo 里）。
- **Don't** 用阴影表达卡片内部层级，也不要叠两层以上阴影卡片。
- **Don't** 用下拉框替代两到四个选项的分段控件。
- **Don't** 加大圆角（>10px）或把按钮做成胶囊。
- **Don't** 在运行中让界面闪烁或跳动：不整页重绘、不先删后加 iframe、不让高度随内容塌陷。
- **Don't** 用 emoji 或插画装饰界面；装饰只有网格和制图角标。
