# 部署与联调指南（从零到一）

前提：已安装以下工具之一
- Windows: Git Bash / PowerShell，建议安装 MinGW-w64 或 Visual Studio
- Linux/macOS: g++ (支持 C++17)
- Node.js + npm/yarn（用于前端）

目录说明：后端源码在 `backend/`，前端在根目录（使用 Vite），API 文档在 `docs/`。

1) 后端构建与运行（快速）

Windows 快速构建（使用项目内脚本）：在项目根或 `backend` 目录下运行：

```powershell
cd backend
build.bat
```

脚本会尝试使用 `g++` 快速编译 `server.cpp`（生成 `lexical_backend.exe`），若失败将回退到 CMake 流程。

运行（如果使用 g++ 编译成功）：

```powershell
cd backend
.\lexical_backend.exe
# 服务监听 0.0.0.0:8080
```

Linux/macOS（用 g++ 直接编译）：

```bash
cd backend
g++ -std=c++17 -O2 -Iinclude server.cpp -o lexical_backend
./lexical_backend
```

注意：后端会在运行目录下自动创建 `data/` 文件夹和四个 CSV 文件：`users.csv`, `words.csv`, `records.csv`, `game_records.csv`。

2) 前端（开发模式）

项目使用 Vite，已在 `package.json` 中设置 dev 脚本监听 `--port=3000`：

```bash
# 在项目根
npm install
npm run dev
# 前端会在 http://localhost:3000 启动
```

3) 前后端联调

- 启动后端（确保监听 8080）
- 启动前端（运行于 3000），前端使用 `src/lib/api.ts` 的 Axios 封装，基地址为 `http://localhost:8080/api`。

4) 快速测试示例（curl）

注册用户：

```bash
curl -X POST http://localhost:8080/api/register -H "Content-Type: application/json" -d '{"username":"alice","password":"pass","role":"user"}'
```

登录：

```bash
curl -X POST http://localhost:8080/api/login -H "Content-Type: application/json" -d '{"username":"alice","password":"pass"}'
```

添加单词：

```bash
curl -X POST http://localhost:8080/api/word/add -H "Content-Type: application/json" -d '{"word":"apple","meaning":"苹果","example":"An apple a day.","pos":"noun","origin":"Old English","creator":"alice","status":"进行中"}'
```

导入 CSV（示例，将 CSV 文本发送在 body 中）：

```bash
curl -X POST http://localhost:8080/api/word/import -H "Content-Type: text/plain" --data-binary @docs/csv_templates/words_template.csv
```

查询单词：

```bash
curl "http://localhost:8080/api/word/list?username=alice"
```

5) CSV 模板

模板位于 `docs/csv_templates/`，包含 `users_template.csv`, `words_template.csv`, `records_template.csv`, `game_records_template.csv`。

6) 注意事项
- 后端严格使用 CSV 文件存储，请确保导入 CSV 字段顺序与模板一致。
- 后端允许跨域访问 `http://localhost:3000`（已在代码设置）。
- 若需管理员操作，请在调用 admin 接口时传入 `role: "admin"`（当前为简化权限校验，生产建议用 token）。
