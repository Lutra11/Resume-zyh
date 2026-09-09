# 首页配置与维护

本仓库用 GitHub 原生 Markdown、HTML 和 SVG 展示钟耀辉的个人介绍，不需要安装网站框架，也不需要启用 GitHub Pages。

## 两种展示入口

- **仓库首页**：打开 <https://github.com/Lutra11/Resume-zyh>，GitHub 会自动渲染根目录 `README.md`。
- **GitHub 账户主页**：GitHub 只会自动展示公开同名仓库 `Lutra11/Lutra11` 的根目录 `README.md`。该仓库已经存在，可以把本仓库的中文 README 复制过去。当前交付只推送 `Resume-zyh`，没有改动已有账户主页仓库。

所有展示图片都指向 `Resume-zyh/main/assets/` 的完整 raw 地址。复制 README 到同名仓库后，图片与中英文入口仍能正常使用。保留本仓库及其 `main` 分支；如果改名或迁移，需同步替换这些地址。

参考：[GitHub Profile README 官方说明](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme)。

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `README.md` | 中文展示页 |
| `README.en.md` | 英文展示页 |
| `assets/avatar.png` | 本人 GitHub 头像 |
| `assets/typing.svg` | 本地保存的打字动画，内嵌字体 |
| `assets/stack.svg` / `stack-dark.svg` | 技术图标的明暗版本 |
| `assets/activity.svg` / `activity-dark.svg` | GitHub 实际贡献日历 |
| `assets/activity.json` | 生成日历使用的聚合数据快照 |
| `scripts/update-activity.mjs` | 更新贡献数据与 SVG |
| `.github/workflows/update-activity.yml` | 定时和手动更新贡献图 |
| `docs/CREDITS.md` | 资料、素材和许可证来源 |

## 修改个人资料

直接编辑两份 README 中对应段落。当前邮箱已由本人确认：`yaohuizhong137@gmail.com`。经历中的“至今”沿用个人网站在 2026-09-09 的公开资料；以后变更工作或教育状态时，应同步修改中英文版本。

项目卡片使用真实仓库链接与文字描述。没有依赖第三方 Star 数、排名或统计卡片，也没有将 Fork 项目写成原创项目。研究条目只描述研究内容，没有推断发表、录用或获奖状态。

## 修改打字动画

使用 [readme-typing-svg 配置工具](https://readme-typing-svg.demolab.com/demo/)。本仓库的配置是：

```text
font=Fira Code
size=25
duration=3000
pause=1200
color=2F81F7
center=true
vCenter=true
width=850
height=64
lines=Hi, I'm Yaohui Zhong;Developer × AI Explorer × Product Designer;Turn ideas into things people can use.
```

下载生成的 SVG 覆盖 `assets/typing.svg`，再提交即可。当前 SVG 已加入系统“减少动态效果”偏好下的静态文字；重新下载后应保留这一适配。动画素材在仓库中本地保存，外部生成服务临时不可用不会导致现有首页动画消失。

## 贡献日历自动更新

贡献数据直接读取 GitHub 公开日历，无需个人访问令牌。GitHub Actions 仅在提交更新时使用仓库内置的 `GITHUB_TOKEN`。它按日运行，也可从 **Actions → Update GitHub activity → Run workflow** 手动触发。更新失败会保留上次成功生成的图片。

本地手动更新需要 Node.js 22 或更新版本和网络连接，无需设置令牌：

```powershell
node scripts/update-activity.mjs
node --test tests/activity.test.mjs
```

工作流只提交贡献图和对应数据，不修改个人介绍。若 GitHub 暂停不活跃仓库的定时任务，可到 Actions 页面重新启用工作流。

## 发布更新

```powershell
Set-Location C:\resume
git status
git add README.md README.en.md assets docs scripts tests .github .gitignore .gitattributes
git commit -m "Update personal profile"
git push origin main
```

在 GitHub 仓库页面检查头像、打字动画、技术图标、贡献图和链接。GitHub 图片代理可能有短暂缓存，刚替换图片时稍后刷新即可。
