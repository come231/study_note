# study_note —— 个人读书笔记整理微信小程序

一个基于微信小程序 + Node.js 的个人笔记管理应用。支持笔记的增删改查、分类管理、收藏、笔记广场（公开笔记浏览与搜索）以及 JWT 登录鉴权。

## 一、功能特性

| 模块 | 说明 |
| --- | --- |
| 用户模块 | 注册、登录、注销、Token 刷新与校验、修改密码、资料修改、用户名/昵称唯一性校验 |
| 笔记模块 | 新建、编辑、详情、删除（支持批量删除）、批量移动分类 |
| 分类模块 | 系统分类 + 用户自定义分类的增删改查 |
| 收藏模块 | 收藏/取消收藏笔记、收藏状态查询、我的收藏列表 |
| 笔记广场 | 浏览他人公开笔记，支持按标题、按作者搜索 |
| 权限控制 | 笔记支持「仅自己可见 / 公开」两种隐私级别，重要程度分三级 |

## 二、技术栈

- **前端**：微信小程序原生开发（WXML / WXSS / JS），基础库 3.14.2
- **后端**：Node.js + Express 5
- **数据库**：MySQL 8.0（`mysql2` 连接池）
- **缓存**：Redis（缓存 JWT 令牌，`ioredis`）
- **鉴权**：JWT（accessToken + refreshToken 双令牌机制）

## 三、目录结构

```
study_note/
├── note_system.sql          # 数据库脚本（建库、建表、触发器、测试数据）
├── study_note_server/       # Node.js 后端
│   ├── app.js               # 服务入口（默认端口 3000）
│   ├── routes/              # 路由层：user / category / note / collect
│   ├── db/
│   │   ├── db_config.js     # MySQL 连接池配置
│   │   └── redis_config.js  # Redis 连接配置
│   ├── utils/
│   │   ├── jwt_util.js      # JWT 生成、校验、刷新
│   │   └── response.js      # 统一响应格式封装
│   ├── system.env           # Redis 环境变量模板（需复制为 .env）
│   └── package.json
└── study_note_program/      # 微信小程序前端
    ├── app.js               # 全局配置（baseUrl 后端地址）
    ├── app.json             # 页面注册与 tabBar 配置
    ├── pages/               # 页面：登录、广场、我的笔记、新建、详情、分类、收藏等
    ├── static/              # 图片等静态资源
    └── utils/               # 请求封装等工具
```

## 四、环境要求

- Node.js 16 及以上
- MySQL 8.0（本地安装并启动）
- Redis 5.0 及以上（本地安装并启动，**必须启动，否则登录后所有接口都会鉴权失败**）
- 微信开发者工具（稳定版）

## 五、使用教程

### 1. 导入数据库

在 MySQL 中执行根目录的 `note_system.sql`，会自动创建 `study_note` 库、5 张表、收藏数统计触发器以及测试数据：

```bash
mysql -uroot -p < note_system.sql
```

也可以用 Navicat / SQLyog 等工具直接运行该脚本。

### 2. 启动 Redis

确保本机 Redis 服务已启动（默认 `127.0.0.1:6379`）。

### 3. 配置并启动 Node 后端

```bash
cd study_note_server

# 1) 安装依赖
npm install

# 2) 修改 db/db_config.js 中的数据库账号密码，改成你本机的
#    host / user / password / database

# 3) 复制环境变量模板（Redis 配置）
cp system.env .env        # Windows: copy system.env .env

# 4) 启动服务
node app.js
```

看到以下输出即表示启动成功：

```
MySQL 数据库连接成功！
Redis 连接成功：127.0.0.1:6379 (db: 0)
✅ 服务器启动成功！
🔗 本机访问：http://localhost:3000
🔗 局域网访问：http://192.168.x.x:3000
```

### 4. 启动前端小程序

1. 打开**微信开发者工具** → 导入项目，目录选择 `study_note_program`。
2. AppID 可填写自己的小程序 AppID，或选择「测试号」。
3. 后端地址配置在 `study_note_program/app.js` 的 `baseUrl`：

   ```js
   baseUrl: "http://localhost:3000/api/"
   ```

   - 用**开发者工具模拟器**调试：保持 `localhost` 即可。
   - 用**真机预览**调试：改成后端输出的局域网地址，如 `http://192.168.1.10:3000/api/`（手机与电脑需在同一 WiFi）。
4. 点击右上角「详情」→「本地设置」，勾选 **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**，否则 `http` 请求会被拦截。
5. 编译运行，小程序启动页 3 秒后自动跳转到「笔记广场」。

### 5. 测试账号

数据库脚本内置了测试用户，密码统一为 `123456`：

| 用户名 | 密码 | 昵称 |
| --- | --- | --- |
| test01 | 123456 | 测试用户 |
| test02 | 123456 | 测试用户02 |
| test03 | 123456 | 测试03 |

## 六、接口文档

所有接口以 `/api` 为前缀，统一返回格式：

```json
{ "code": 200, "msg": "操作成功", "data": {} }
```

### 用户 `/api/user`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/register` | 注册（username、password、nickname） |
| POST | `/login` | 登录，返回用户信息 + accessToken + refreshToken |
| GET | `/check-username` | 校验用户名是否可用 |
| GET | `/check-nickname` | 校验昵称是否可用 |
| GET | `/check-token` | 校验 accessToken 是否有效 |
| GET | `/refresh` | 用 refreshToken 刷新访问令牌 |
| GET | `/logout` | 退出登录（清除 Redis 中的令牌） |
| GET | `/profile` | 获取用户资料 |
| POST | `/update` | 修改用户资料 |
| POST | `/change-pwd` | 修改密码 |

### 笔记 `/api/note`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/list` | 我的笔记列表（分类、重要程度筛选） |
| GET | `/public` | 笔记广场（公开笔记列表） |
| GET | `/list/by-title` | 我的笔记按标题搜索 |
| GET | `/public/by-title` | 公开笔记按标题搜索 |
| GET | `/public/by-author` | 公开笔记按作者搜索 |
| GET | `/detail` | 笔记详情 |
| POST | `/add` | 新建笔记 |
| POST | `/update` | 编辑笔记 |
| POST | `/batch/delete` | 批量删除 |
| POST | `/batch/move-category` | 批量移动分类 |

### 分类 `/api/category`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/list` | 分类列表（系统分类 + 我的自定义分类） |
| POST | `/add` | 新增自定义分类 |
| POST | `/update` | 修改分类 |
| POST | `/delete` | 删除分类 |

### 收藏 `/api/collect`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/add` | 收藏笔记 |
| POST | `/cancel` | 取消收藏 |
| GET | `/check` | 查询是否已收藏 |
| GET | `/list` | 我的收藏列表 |

## 七、数据库表说明

| 表名 | 说明 |
| --- | --- |
| `user` | 用户表（账号、密码、昵称、头像、手机号） |
| `note` | 笔记主表（标题、内容、隐私级别、重要程度、收藏数） |
| `note_category` | 分类表（系统分类 / 用户自定义分类） |
| `note_collect` | 收藏关系表，含触发器自动维护 `note.collect_count` |
| `note_media` | 笔记媒体表（预留） |

## 八、常见问题

**1. 启动后接口一直返回「令牌已失效」或 401**
Redis 没有启动。JWT 令牌会同步缓存到 Redis，鉴权时需比对缓存值，请先启动 Redis 再重启后端。

**2. 小程序报「不在以下 request 合法域名列表中」**
在开发者工具「详情 → 本地设置」中勾选「不校验合法域名…」。

**3. 真机预览连不上后端**
把 `study_note_program/app.js` 的 `baseUrl` 改为电脑的局域网 IP，并确认手机和电脑在同一网络、电脑防火墙未拦截 3000 端口。

**4. 重启后端后需要重新登录**
`JWT_SECRET` 未配置时会随机生成，重启后旧令牌全部失效。可在 `.env` 中补充固定密钥，例如：

```
JWT_SECRET=your_fixed_secret_key
JWT_EXPIRES_IN=7200s
JWT_REFRESH_EXPIRES_IN=86400s
```

**5. Node 版本报错**
请使用 Node.js 16 及以上版本；Express 5 与 `mysql2` 均依赖较新的运行时。
