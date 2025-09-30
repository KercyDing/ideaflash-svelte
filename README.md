# IdeaFlash

现代化的 SvelteKit 多工具集合，主打高性能与极简交互。当前仓库提供以下模块：

- **WebShareX**：云端安全文件方舟，可上传、整理、分享文件夹与文件。
- **Dashboard**：实时可视化看板，展示 WebShareX 的关键使用指标。

---

## 功能模块

### 📦 WebShareX - 云端文件方舟

**核心功能:**

- ✅ **房间隔离** - 多房间支持，密码保护
- ✅ **云端存储** - 阿里云 OSS 集成，支持大文件
- ✅ **文件夹管理** - 无限层级，自动持久化
- ✅ **原文件名** - 保持原始文件名，支持中文
- ✅ **在线重命名** - 文件/文件夹重命名同步 OSS
- ✅ **临时分享** - 带密码和过期时间的分享链接
- ✅ **拖拽上传** - 现代化交互体验

**技术架构:**

- MySQL + Drizzle ORM - 元数据存储
- 阿里云 OSS - 文件对象存储

**OSS 文件结构:**

```
websharex/
├── {roomName}/
│   ├── 文档.pdf                  # 保持原文件名
│   └── {folderId}/
│       └── 照片.jpg
```

### 📊 Dashboard - 数据看板

**可视化指标:**

- 📈 上传趋势 (每日/每周折线图)
- 🎨 文件类型分布 (15+ 类型饼图)
- 💾 存储空间统计
- 🔍 文件排序和筛选

---

## 快速开始

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

### 3. 配置阿里云 OSS (可选)

如需使用阿里云 OSS 存储文件,继续在 `.env.local` 中添加:

```env
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_ACCESS_KEY_ID=your_access_key_id
ALIYUN_OSS_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_OSS_BUCKET=your_bucket_name
ALIYUN_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
```

**获取阿里云 OSS 配置信息:**

1.  登录 [阿里云控制台](https://oss.console.aliyun.com/bucket)
2.  创建或选择一个 Bucket,获取 `BUCKET` 名称和 `REGION`
3.  在 [AccessKey 管理](https://ram.console.aliyun.com/users) 创建 AccessKey,获取 `ACCESS_KEY_ID` 和 `ACCESS_KEY_SECRET`
    - **推荐使用主账号 AccessKey** (开发测试环境)
    - **使用 RAM 子账号时需要授权**: 进入 [RAM 控制台](https://ram.console.aliyun.com/users) → 选择用户 → 添加权限 → 选择全部策略
4.  `ENDPOINT` 格式为: `oss-{region}.aliyuncs.com`

**OSS Bucket 配置建议:**

- ✅ 开启服务端加密 (OSS 完全托管)
- ✅ 配置 CORS 规则 (允许 `*` 或你的域名)
- ✅ 设置生命周期规则 (自动清理过期文件)

### 4. 启动开发服务器

```sh
bun run dev
```

访问 `http://localhost:5173` 体验应用。

### 5. 其他命令

```bash
# 运行类型检查
bun run check

# 构建生产版本
bun run build
```

---

## 技术栈

| 分类       | 技术                                 |
| :--------- | :----------------------------------- |
| **框架**   | SvelteKit, TypeScript, Vite          |
| **运行时** | Bun                                  |
| **UI**     | Tailwind CSS, shadcn-svelte, Iconify |
| **数据库** | MySQL, Drizzle ORM                   |
| **存储**   | 阿里云 OSS                           |
| **图表**   | Chart.js                             |
| **工具**   | ESLint, Prettier                     |

---

## 项目结构

```
ideaflash-svelte/
├── src/
│   ├── lib/
│   │   ├── db/              # 数据库配置和 schema
│   │   ├── server/          # 服务端逻辑
│   │   │   ├── oss.ts       # OSS 服务
│   │   │   └── websharex.ts # WebShareX 数据库操作
│   │   └── websharex/       # WebShareX 前端逻辑
│   │       ├── store.ts     # 状态管理
│   │       └── types.ts     # 类型定义
│   └── routes/
│       ├── api/             # API 路由
│       │   └── websharex/   # WebShareX API
│       ├── dashboard/       # Dashboard 页面
│       └── websharex/       # WebShareX 页面
├── .env.local               # 环境变量 (不提交到 Git)
├── .env.local.example       # 环境变量模板
├── drizzle.config.ts        # Drizzle ORM 配置
└── OSS_INTEGRATION.md       # OSS 集成详细文档
```

---

## API 接口

### WebShareX API

| 方法     | 路径                                       | 功能         |
| :------- | :----------------------------------------- | :----------- |
| `POST`   | `/api/websharex/rooms`                     | 创建房间     |
| `GET`    | `/api/websharex/rooms`                     | 获取所有房间 |
| `DELETE` | `/api/websharex/rooms`                     | 删除房间     |
| `POST`   | `/api/websharex/rooms/{name}/files`        | 上传文件     |
| `POST`   | `/api/websharex/rooms/{name}/folders`      | 创建文件夹   |
| `PATCH`  | `/api/websharex/rooms/{name}/entries/{id}` | 重命名       |
| `GET`    | `/api/websharex/rooms/{name}/files/{id}`   | 获取下载 URL |
| `DELETE` | `/api/websharex/rooms/{name}/files`        | 删除文件     |

---

## 部署建议

### 服务器要求

- Node.js 18+ 或 Bun 1.0+
- MySQL 8.0+
- 阿里云 OSS Bucket

### 部署步骤

1.  **克隆仓库**
    ```bash
    git clone https://github.com/KercyDing/ideaflash-svelte.git
    cd ideaflash-svelte
    ```
2.  **安装依赖**
    ```bash
    bun install
    ```
3.  **配置环境变量**
    ```bash
    cp .env.local.example .env.local
    # 编辑 .env.local 填入真实配置
    ```
4.  **构建项目**
    ```bash
    bun run build
    ```
5.  **启动服务**

    ```bash
    # 使用 PM2 (推荐)
    pm2 start build/index.js --name ideaflash

    # 或直接运行
    node build/index.js
    ```

---

## 性能优化

### 前端

- 代码分割
- 图片懒加载
- 虚拟滚动

### 后端

- OSS 临时签名 URL
- 数据库连接池
- API 响应缓存

---

## 安全特性

### 访问控制

- 房间密码验证
- 临时签名 URL
- RAM 子账号

### 数据保护

- OSS 服务端加密
- HTTPS 传输
- 环境变量隔离

### 文件管理

- 文件类型验证
- 自动删除 OSS 孤立文件
- 过期文件自动清理

---

## 故障排查

### OSS 权限错误 (AccessDenied)

**错误信息:** `The bucket you access does not belong to you`

**解决方案:**

1.  **检查 AccessKey 是否正确**
    ```bash
    bun check-oss-config.js  # 运行配置检查工具
    ```
2.  **使用主账号 AccessKey** (推荐开发环境)
    - 登录阿里云控制台 → 头像 → AccessKey 管理
    - 创建主账号 AccessKey 并更新 `.env.local`
3.  **RAM 子账号授权** (推荐生产环境)
    - 进入 [RAM 控制台](https://ram.console.aliyun.com/users)
    - 选择对应的 RAM 用户 → 点击"添加权限"
    - 搜索并选择 `AliyunOSSFullAccess` 策略
    - 或自定义权限策略 (最小权限原则):
      ```json
      {
        "Version": "1",
        "Statement": [
          {
            "Effect": "Allow",
            "Action": [
              "oss:ListObjects",
              "oss:GetObject",
              "oss:PutObject",
              "oss:DeleteObject"
            ],
            "Resource": [
              "acs:oss:*:*:your-bucket-name",
              "acs:oss:*:*:your-bucket-name/*"
            ]
          }
        ]
      }
      ```
4.  **重启开发服务器**
    ```bash
    # 停止当前服务 (Ctrl+C)
    bun run dev
    ```

### 上传失败

1.  检查 AccessKey 权限
2.  确认 Bucket CORS 配置
3.  查看浏览器控制台错误
4.  检查网络连接

### 下载失败

1.  确认文件存在于 OSS
2.  检查签名 URL 是否过期
3.  验证房间权限

### 数据库连接失败

1.  检查 MySQL 服务状态
2.  确认 `.env.local` 配置正确
3.  验证网络连接

---

## 开发

### 开发模式

```bash
bun run dev
```

### 类型检查

```bash
bun run check
```

### 代码格式化

```bash
bun run format
```

---

## 许可证

MIT License

Copyright © 2025-2026 Kercy. All rights reserved.

---

## 相关链接

- 📖 [详细 OSS 集成文档](./OSS_INTEGRATION.md)
- 📖 [项目指南](./Instructor.md)
- 🔗 [GitHub 仓库](https://github.com/KercyDing/ideaflash-svelte)
- 🌐 [在线演示](https://ideaflash.cn)

---

## 贡献

欢迎提交 Issue 和 Pull Request！

**开发原则:**

- 代码简洁，避免冗余注释
- 效率至上，用最少的代码解决问题
- 结构清晰，遵循 SvelteKit 约定
- 专业呈现，保持代码通用性
