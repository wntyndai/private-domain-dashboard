# 私域新客群监控看板 · 公开演示项目

包含经营总览、资源位分析、群转化和召回链路四个页面，支持日度/月度、同期对比、经营摘要和资源位贡献排名。

**全部展示数值为独立生成的模拟数据，不是原经营数据的缩放、加噪或抽样。** 此项目不含数据库连接、账号凭证或在线数据源配置。

## 文件说明

| 路径 | 用途 |
| --- | --- |
| `index.html` | 最终离线网页，也是 GitHub Pages 首页；双击即可使用 |
| `src/content/dashboard/` | 实际看板 React、CSS、日期计算、同期对比、排名、散点图和平滑曲线代码 |
| `src/theme.css` | 看板主题 |
| `sql/` | 四份查询逻辑模板；库表、群名、渠道和策略已替换为示例名称 |
| `data/metrics.json` | 公开指标字典，仅含名称、分组和数据类型 |
| `data/demo-snapshot.json` | 独立模拟数据，供源码构建使用 |
| `scripts/generate-demo.mjs` | 可复现的模拟数据生成器，不接入真实来源 |
| `scripts/build.mjs` | 基于已安装的 Data 插件构建离线 HTML |
| `scripts/check-public.mjs` | 检查网页内嵌数据与模拟快照一致，并检查常见敏感内容 |
| `docs/` | 数据结构、SQL 模板说明与公开包检查记录 |

## 手动上传 GitHub

1. 打开目标仓库，选择 **Add file → Upload files**。
2. 将**本文件夹里面的文件和子文件夹**拖入上传区，使 `index.html`、`README.md`、`src/`、`sql/`、`scripts/`、`data/` 直接位于仓库根目录。不要上传外层文件夹或 ZIP 作为网站首页。
3. 提交更改。`.gitignore` 和 `.nojekyll` 如未被拖入，可单独添加。
4. 如果仓库已有 GitHub Pages 配置，保持其发布分支和根目录设置；若尚未配置，到仓库的 **Settings → Pages** 选择该分支的根目录。最终地址以 Pages 页面显示的地址为准。

GitHub Pages 直接使用已生成的 `index.html`，不需要安装 Data 插件或运行 SQL。若旧仓库中曾上传过真实数据，本文件夹不会清除旧提交中的内容。

## 本地修改与重新构建

浏览网页：直接打开 `index.html`。也可在此目录执行 `python -m http.server 8080 --bind 127.0.0.1`，然后访问 `http://127.0.0.1:8080`。

源码使用 React 和 Data 的公共组件接口。共享运行时由 **Data 插件 1.0.11** 提供；本包包含业务源码和完整编译网页，不复制插件运行时源码。重新构建需要 Node.js 22+ 和已安装的 Data 插件，不需要安装本项目的 npm 依赖。

在 PowerShell 中设置你自己的插件目录，然后执行：

```powershell
$env:DATA_PLUGIN_ROOT = '你的 Data 插件安装目录'
node scripts/build.mjs
```

构建会生成模拟数据、在 `.build/` 创建编译工作目录，再输出根目录 `index.html` 并执行公开检查。`.build/` 不应上传，使用网页手动上传时也应排除它。更新源码后重新运行构建，不能只修改 JSX 就期待已生成的 HTML 自动变化。

```powershell
node scripts/generate-demo.mjs
node scripts/check-public.mjs
```

数据区间固定为 2026-06-01 至 2026-11-07，旨在展示六个月的交互效果，不代表实际数据更新状态。SQL 模板是逻辑参考，未在演示网页中执行；运行前需使用自己的表结构、业务定义及兼容 SQL 方言。

不要把真实数据写入公开的 `data/` 或 `index.html`；静态网页中的内嵌数据可由访问者读取。
