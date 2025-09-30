# IdeaFlash

现代化的 SvelteK## 快速开始

### 1. 安装依赖

```sh
bun install
```

### 2. 配置数据库

复制环境变量模板文件:

```sh
cp .env.local.example .env.local
```

编辑 `.env.local` 文件,填入你的 MySQL 数据库信息:

```env
MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=your_database_name
```

### 3. 启动开发服务器

```sh
bun run dev
```

### 4. 其他命令

```sh
# 运行类型检查
bun run check

# 构建生产版本
bun run build
```

访问 `http://localhost:5173` 体验应用。交互。当前仓库提供以下模块：

- **WebShareX**：本地模拟的安全文件方舟，可上传、整理、分享文件夹与文件。
- **Dashboard**：实时可视化看板，展示 WebShareX 的关键使用指标。

## 功能速览

### WebShareX

- 拖拽或多选上传文件，浏览器端自动 Base64 模拟存储。
- 无限层级的文件夹树，支持新建、重命名与级联删除。
- 文件下载、过期时间与访问密码设置，用于模拟临时分享流程。
- 面包屑导航便于返回上级目录。

> **说明**：当前实现基于浏览器 `localStorage` 与 Base64 存储，仅用于演示流程，未接入实际 OSS。

### Dashboard

- 概览卡片：文件、文件夹总数与占用空间快速总览。
- 折线图追踪每日上传趋势，洞察活跃度。
- 饼图展示文件类型分布。
- 最新上传列表，便于核对近期操作。

## 快速开始

```sh
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 运行类型检查
bun run check

# 构建生产版本
bun run build
```

访问 `http://localhost:5173` 体验应用。在无后端的情况下，浏览器刷新会保留当前模拟数据；如需清空，删除 `localStorage` 中的 `ideaflash:websharex` 键即可。
