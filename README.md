# 日本程序員求職面試練習器 / Japanese Interview Coach

> AI驱动的日语面试练习平台，专为在日求职的外国程序员设计

---

## 📋 项目简介

这是一个全栈Web应用，结合AI智能分析、语音识别、PREP法训练等功能，帮助外国程序员（特别是中文母语者）提升日语面试能力。

**核心价值**：
- ✅ AI 实时反馈（Gemini API）
- ✅ 语音识别练习（STT）
- ✅ PREP 法回答训练
- ✅ 智能单词本（支持Notion同步）
- ✅ 个性化题库（基于简历生成）

---

## 🚀 功能特性

### 1️⃣ 用户系统
- 邮箱注册/登录（带Session管理）
- 个人资料编辑
- 数据隔离（用户间互不可见）

### 2️⃣ 简历解析
- 支持格式：PDF、DOCX、TXT
- AI自动提取：技能、经验、学历
- 生成个性化面试题（基于简历内容）

### 3️⃣ 面试题库
- 分类：HR（软技能）/ Tech（技术）
- PREP法模板：Point → Reason → Example → Point
- AI生成题目（带去重）
- 增删改查管理

### 4️⃣ AI 辅导系统
- 回答质量评估（自然度、商务性）
- 逻辑结构分析（PREP法检测）
- 具体改进建议
- 生成修正版本

### 5️⃣ 语音练习
- 浏览器录音（MediaRecorder）
- 语音转文字（Gemini Multimodal API）
- 模拟真实面试环境

### 6️⃣ 智能单词本
- 划词取词（浮动按钮）
- AI分析单词/短语
- 闪卡复习模式
- **Notion云同步**（可选）

### 7️⃣ 收藏系统
- 保存练习记录
- AI反馈归档
- 对话历史追踪
- 个人错题本

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18, Tailwind CSS, Lucide Icons |
| **后端** | Node.js, Express |
| **数据库** | SQLite (better-sqlite3) |
| **AI** | Google Gemini API (Text + Multimodal) |
| **集成** | Notion API (可选云同步) |
| **构建** | Vite |

---

## 📦 环境准备

### 系统要求
- Node.js >= 18.0
- npm >= 9.0

### 获取API密钥

1. **Gemini API Key**（必需）
   - 访问：https://makersuite.google.com/app/apikey
   - 点击"Create API Key"
   - 复制密钥（以`AI`开头）

2. **Notion Integration**（可选，用于单词本同步）
   - 访问：https://www.notion.so/my-integrations
   - 创建Internal Integration
   - 复制Token（以`ntn_`开头）
   - 创建数据库并连接Integration
   - 复制Database ID（URL中32位字符）

---

## 🚀 部署方法

### 开发环境启动

```bash
# 1. 克隆/下载项目
cd /path/to/InterviewHelper

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入API密钥：
# VITE_GEMINI_API_KEY=你的Gemini密钥
# NOTION_API_KEY=你的Notion密钥（可选）
# NOTION_DATABASE_ID=你的Notion数据库ID（可选）

# 4. 初始化数据库（自动创建表结构）
npm run db:init

# 5. 启动开发服务器（前端+后端）
npm run dev:all
# 前端: http://localhost:3000
# 后端: http://localhost:3002
```

### 生产环境部署

```bash
# 1. 构建前端
npm run build

# 2. 启动后端服务器
npm run server

# 3. 使用Nginx代理静态文件（推荐）
# 配置示例：
# server {
#   listen 80;
#   root /path/to/InterviewHelper/dist;
#   location /api {
#     proxy_pass http://localhost:3002;
#   }
# }

# 4. 使用PM2守护进程（推荐）
npm install -g pm2
pm2 start server/api.js --name interview-coach
pm2 save
pm2 startup
```

---

## 🗄️ 数据库说明

### SQLite → MySQL 迁移指南

当前使用SQLite（`interview-coach.db`），如需迁移到MySQL：

#### 1. 修改依赖
```bash
npm uninstall better-sqlite3
npm install mysql2
```

#### 2. 修改 `server/db.js`
```javascript
// 替换 better-sqlite3 为 mysql2
import mysql from 'mysql2/promise';

// 创建连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'interview_coach',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 修改SQL语法差异
// SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
// MySQL:  INT AUTO_INCREMENT PRIMARY KEY

// SQLite: DATETIME DEFAULT CURRENT_TIMESTAMP
// MySQL:  DATETIME DEFAULT CURRENT_TIMESTAMP

// SQLite: TEXT
// MySQL:  TEXT 或 VARCHAR(长度)

// 修改查询语句
// SQLite: db.prepare().get() / .all() / .run()
// MySQL:  await pool.query()
```

#### 3. 核心差异对照

| 特性 | SQLite | MySQL |
|------|--------|-------|
| 自增主键 | `INTEGER PRIMARY KEY AUTOINCREMENT` | `INT AUTO_INCREMENT PRIMARY KEY` |
| 布尔类型 | `BOOLEAN` (存为0/1) | `BOOLEAN` 或 `TINYINT(1)` |
| 文本类型 | `TEXT` | `TEXT`, `VARCHAR(255)`, `MEDIUMTEXT` |
| JSON存储 | `TEXT` (手动序列化) | `JSON` (原生支持) |
| 外键 | 需手动启用 `PRAGMA foreign_keys = ON` | 默认启用（InnoDB） |
| 同步查询 | `db.prepare().run()` | 需改为 `await pool.query()` |

#### 4. 迁移SQL语句示例

```sql
-- users表（SQLite → MySQL）
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,  -- 改为 INT AUTO_INCREMENT
  email VARCHAR(255) UNIQUE NOT NULL,  -- TEXT → VARCHAR
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  avatar_url VARCHAR(500),
  target_language VARCHAR(10) DEFAULT 'ja',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)  -- 添加索引
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- vocabulary_notes表示例
CREATE TABLE vocabulary_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  word VARCHAR(255) NOT NULL,
  translation TEXT,
  explanation TEXT,
  example_sentences TEXT,  -- 或改为 JSON 类型
  tags VARCHAR(500),        -- 或改为 JSON 类型
  notion_page_id VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_word (word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 5. 环境变量配置
```env
# .env 文件新增
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=interview_coach
```

#### 6. 数据迁移工具
```bash
# 使用sqlite3命令导出数据
sqlite3 interview-coach.db .dump > dump.sql

# 手动修改dump.sql中的语法差异后导入MySQL
mysql -u root -p interview_coach < dump.sql
```

---

## 📂 项目结构

```
InterviewHelper/
├── server/              # 后端
│   ├── api.js          # Express服务器 + API路由
│   ├── db.js           # 数据库初始化 + Schema
│   └── notion.js       # Notion集成（可选）
├── src/                # 前端
│   ├── App.jsx         # 主组件（单文件架构）
│   ├── utils/          # 工具函数
│   │   └── api.js      # API客户端封装
│   ├── main.jsx        # React入口
│   └── index.css       # 全局样式
├── scripts/            # 脚本
│   └── init-db.js      # 数据库初始化脚本
├── .env.example        # 环境变量模板
├── package.json        # 依赖配置
└── vite.config.js      # Vite构建配置
```

---

## 🔧 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev:all` | 启动前端+后端开发服务器 |
| `npm run dev` | 仅启动前端（Vite） |
| `npm run server` | 仅启动后端（Express） |
| `npm run build` | 构建生产版本 |
| `npm run db:init` | 初始化数据库 |

---

## 🌟 Notion集成（可选）

单词本功能支持自动同步到Notion数据库，实现云端备份。

### 配置步骤
1. 在Notion创建数据库，添加以下列：
   - `単語` (Title) - 日语单词
   - `翻訳` (Text) - 中文翻译
   - `解説` (Text) - 详细解释
   - `例文` (Text) - 例句
   - `タグ` (Multi-select) - 标签
   - `Created time` (Created time) - 自动记录时间

2. 创建Integration并连接数据库

3. 配置 `.env`：
```env
NOTION_API_KEY=secret_xxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxx
```

4. 重启服务器，保存单词时自动同步

---

## ⚠️ 注意事项

1. **API配额**：Gemini API有免费额度限制，生产环境建议升级付费计划
2. **数据安全**：`.env` 文件包含密钥，已在 `.gitignore` 中排除，切勿提交
3. **数据库**：SQLite适合开发/小规模，生产环境建议迁移到MySQL/PostgreSQL
4. **Notion同步**：可选功能，不配置仍可正常使用本地单词本

---

## 📄 开源协议

MIT License - 自由使用、修改、分发

---

## 🙋 常见问题

**Q: 如何重置数据库？**  
A: 删除 `interview-coach.db` 文件，运行 `npm run db:init`

**Q: Notion同步失败？**  
A: 检查数据库列名是否与代码一致（需包含 `解説` 列）

**Q: 语音识别不工作？**  
A: 需使用HTTPS或localhost，并授予麦克风权限

**Q: 如何更换AI模型？**  
A: 修改 `src/App.jsx` 中的模型名称（如改为 `gemini-1.5-pro`）

---

**快速开始**: `npm install && npm run dev:all`

### 5. 构建生产版本

```bash
npm run build
npm run preview
```

## 📚 使用指南

### 第一次使用

1. **注册账号**
   - 使用邮箱和密码注册
   - 可选填写用户名

2. **上传简历**（可选但推荐）
   - 点击"履歴書"标签
   - 上传你的简历文件
   - AI 会自动提取关键信息

3. **开始练习**
   - 选择 HR 或 Tech 类别
   - 点击"練習"按钮开始
   - 输入文字回答或使用语音录制
   - 获取 AI 实时反馈

### PREP 法回答框架

所有模范回答都遵循 PREP 法：

```
【Point】结论先行
先明确表达你的观点或答案

【Reason】说明理由
解释为什么这样回答

【Example】举具体例子
用实际案例支撑你的观点

【Point】重申结论
再次强调你的核心观点
```

### AI 反馈说明

AI 会从以下角度评估你的回答：

- **评分**: 0-100 分
- **总评**: 整体评价
- **改进建议**: 3-5 条具体建议
- **修正版**: 更自然的商务日语表达

### 题库管理

- **手动添加**: 自己创建题目
- **AI 生成**: 基于你的简历和已有题目生成 3 个新问题
- **编辑/删除**: 只能编辑自己创建的题目
- **收藏**: 标记重要题目到"お気に入り"

## 🎯 项目特色

### 1. 隐私保护
- 简历不保存原始文件，仅保存 AI 解析后的关键信息
- 所有数据存储在本地
- 用户数据与账号绑定，不会泄露

### 2. AI 驱动
- 智能问题生成，避免重复
- 精准的日语表达分析
- 实时语音转文字

### 3. 实战导向
- 基于真实日本企业面试题
- PREP 法训练逻辑思维
- 商务日语表达优化

## 🔧 开发说明

### 项目结构

```
InterviewHelper/
├── src/
│   ├── App.jsx              # 主应用组件
│   ├── main.jsx            # 入口文件
│   ├── index.css           # 全局样式
│   └── utils/
│       ├── database.js     # 数据库操作（localStorage）
│       └── gemini.js       # Gemini API 调用
├── scripts/
│   └── init-db.js          # SQLite 初始化脚本（可选）
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env.example
```

### API 调用

所有 Gemini API 调用都在 `src/utils/gemini.js` 中：

- `getAIFeedback()`: 分析回答
- `transcribeAudio()`: 语音转文字
- `generateQuestions()`: 生成新题目
- `parseResume()`: 解析简历

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 License

MIT License


