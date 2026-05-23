# English Class — 词汇学习平台

一个全栈英语词汇学习应用，包含词库管理、词汇测试、单词接龙游戏、用户社区和后台管理。内置 CET-4/CET-6 完整词库（5724 词），支持自定义词库、错词本和学习进度追踪。

---

## 功能概览

### 学习者端
| 模块 | 功能 |
|------|------|
| **仪表盘** | 学习速率周柱状图、正确率环形图、连续打卡天数、每日一词推荐 |
| **词条录入** | 单条录入 + CSV 批量导入，英文单词自动对接词典 API 校验拼写 |
| **词库查询** | 个人词库 / 四级 / 六级 / 全局 / 错词本 / 自定义词库，支持搜索和批量导入 |
| **词汇测试** | 英译汉 / 汉译英双模式，实时统计，每日目标追踪，答错跳过自动加入错词本 |
| **单词接龙** | 60 秒限时，词典 API 验词，首字母匹配，支持选择词库范围 |
| **用户社区** | 发帖/评论/点赞/收藏/好友系统，内置单词上传功能 |

### 管理员端
| 模块 | 功能 |
|------|------|
| **管理仪表盘** | 总用户数、今日新增单词、活跃用户排行 |
| **词典管理** | 全局词典增删改查 |
| **审核中心** | 审核用户提交的单词、词条 |
| **用户管理** | 禁用/启用、重置密码、提升/降级管理员 |
| **社区管理** | 删除帖子/评论、禁言用户 |
| **游戏监管** | 查看游戏记录 |
| **系统配置** | 公告、维护模式开关 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| **前端** | React 19 + TypeScript + Vite + Tailwind CSS + Recharts + Framer Motion |
| **后端** | C++17 + cpp-httplib + nlohmann/json |
| **数据存储** | CSV 文件系统（users/words/records/game_records/dictionary/contributions/community） |
| **外部 API** | [Free Dictionary API](https://dictionaryapi.dev/) — 单词真实性校验 |

---

## 快速开始

### 前提条件
- Node.js ≥ 18
- g++ ≥ 8（支持 C++17）或 MinGW-w64（Windows）

### 1. 克隆项目
```bash
git clone <repo-url>
cd english_class
```

### 2. 编译后端
```bash
# Windows
cd backend
g++ -std=c++17 -O2 -Iinclude server.cpp -o lexical_backend.exe -lws2_32

# Linux/macOS
cd backend
g++ -std=c++17 -O2 -Iinclude server.cpp -o lexical_backend -lpthread
```

### 3. 启动后端
```bash
cd backend
./lexical_backend    # 监听 http://localhost:8080
```

### 4. 安装前端依赖并启动
```bash
npm install
npm run dev          # 监听 http://localhost:3000
```

### 5. 打开浏览器
访问 `http://localhost:3000`

### 默认账号
| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| student | 123456 | 学习者 |

---

## 项目结构

```
english_class/
├── backend/
│   ├── server.cpp              # 单文件 C++17 后端（全部 API）
│   ├── include/
│   │   ├── httplib.h           # HTTP 库
│   │   └── json.hpp            # JSON 库
│   ├── data/                   # CSV 数据文件（运行时生成）
│   │   ├── users.csv
│   │   ├── words.csv
│   │   ├── records.csv
│   │   ├── dictionary.csv      # CET4/CET6 词库 (~5724 词)
│   │   ├── contributions.csv
│   │   ├── game_records.csv
│   │   ├── posts.csv / comments.csv / likes.csv / friends.csv  # 社区
│   │   ├── mistakes.csv        # 错词本
│   │   └── custom_banks.csv / custom_bank_words.csv
│   ├── fetch_vocabulary.py     # CET4/6 词汇抓取脚本
│   └── build.bat               # Windows 编译脚本
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx        # 登录 / 注册
│   │   ├── DashboardPage.tsx    # 仪表盘（用户 + 管理员）
│   │   ├── EntryPage.tsx        # 词条录入 + 批量导入
│   │   ├── DictionaryPage.tsx   # 词库查询和浏览
│   │   ├── TestPage.tsx         # 词汇测试
│   │   ├── GamePage.tsx         # 单词接龙
│   │   ├── CommunityPage.tsx    # 用户社区
│   │   ├── SettingsPage.tsx     # 个人设置
│   │   ├── ContributePage.tsx   # 单词上传（已整合到社区）
│   │   ├── AdminDictionary.tsx  # 词库管理（管理员）
│   │   ├── AdminReview.tsx      # 审核中心（管理员）
│   │   ├── AdminCommunity.tsx   # 社区管理（管理员）
│   │   ├── AdminGameRecords.tsx # 游戏监管（管理员）
│   │   ├── AdminConfig.tsx      # 系统配置（管理员）
│   │   └── UsersPage.tsx        # 用户管理（管理员）
│   ├── components/Navigation.tsx
│   ├── lib/
│   │   ├── api.ts               # Axios 封装 + 全部 API 函数
│   │   └── utils.ts
│   ├── types.ts                 # TypeScript 类型定义
│   ├── App.tsx                  # 路由和页面分发
│   └── main.tsx                 # 入口
├── index.html
├── package.json
├── vite.config.ts               # Vite 配置（含 /api 代理到 :8080）
└── tsconfig.json
```

---

## API 文档摘要

全部接口前缀 `/api`，前端通过 Vite 代理转发到后端 8080 端口。

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/register` | 注册（强制学习者角色） |
| POST | `/login` | 登录（返回用户信息和统计） |
| POST | `/change_password` | 修改密码 |

### 单词 & 词典
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/word/add` | 添加单词到个人词库 |
| POST | `/word/import` | 批量导入 CSV |
| GET | `/word/list` | 获取单词列表 |
| GET | `/dictionary/search` | 搜索全局词典（支持 source 过滤） |
| GET | `/daily_word` | 每日一词（从全局词典随机） |

### 测试 & 统计
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/test/random` | 获取随机测试题目 |
| POST | `/test/submit` | 提交答案 |
| GET | `/records` | 查询测试记录 |
| GET | `/stats` | 获取用户统计数据 |

### 错词本
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/mistake/add` | 加入错词本 |
| GET | `/mistake/list` | 查看错词本 |
| POST | `/mistake/remove` | 移除单词（或自动答对3次移除） |

### 自定义词库
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/custom_bank/create` | 创建自定义词库 |
| GET | `/custom_bank/list` | 列出所有自定义词库 |
| POST | `/custom_bank/add_words` | 批量导入单词 |
| GET | `/custom_bank/words` | 查看词库单词 |
| POST | `/custom_bank/delete` | 删除词库 |

### 游戏
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/game/start` | 开始游戏 |
| POST | `/game/submit` | 保存游戏记录 |

### 社区
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/community/post/create` | 发帖 |
| GET | `/community/posts` | 帖子列表 |
| POST | `/community/comment/create` | 发表评论 |
| POST | `/community/toggle_like` | 点赞/取消 |
| POST | `/community/toggle_favorite` | 收藏/取消 |
| POST | `/community/friend/request` | 发送好友申请 |
| POST | `/community/friend/accept` | 接受好友 |

### 管理员
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/dashboard` | 管理仪表盘 |
| GET | `/admin/users` | 用户列表 |
| POST | `/admin/user/disable` / `enable` | 禁用/启用用户 |
| POST | `/admin/user/reset_password` | 重置用户密码（随机生成） |
| POST | `/admin/user/set_role` | 设置用户角色 |
| POST | `/admin/contributions/approve` / `reject` | 审核单词贡献 |
| POST | `/admin/community/post/delete` | 删除社区帖子 |

---

## 部署

### 开发环境
前后端分别启动即可，前端 3000 端口自动代理到后端 8080。

### 生产环境
```bash
# 1. 构建前端
npm run build        # 产物在 dist/

# 2. 使用 nginx 托管
# /api/*  → proxy_pass http://localhost:8080
# 其他     → root dist/

# 3. 后台运行后端
cd backend && nohup ./lexical_backend &
```

---

## 词汇数据

运行抓取脚本导入 CET-4/CET-6 完整词库：
```bash
cd backend
python fetch_vocabulary.py          # 5724 词
python fetch_vocabulary.py --cet4   # 仅四级 (~4220 词)
python fetch_vocabulary.py --cet6   # 仅六级 (~1504 词)
```

数据来源：[mahavivo/english-wordlists](https://github.com/mahavivo/english-wordlists)
