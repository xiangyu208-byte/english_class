# 单词记忆助手 — 后端 REST API 文档

基础地址: http://localhost:8080/api

通用响应体：

```
{
  "code": 200 | 500,
  "msg": "操作提示文本",
  "data": 任意业务数据
}
```

注意：POST 请求使用 JSON 请求体，GET 使用 URL 参数。

---

## /api/ping
- 方法：GET
- 描述：健康检查
- 返回：{ code:200, msg:"pong", data:{time: <unix_ts>} }

## /api/register
- 方法：POST
- 请求体：{ username, password, role }
- 功能：用户注册（role: 'user' 或 'admin'）
- 返回：{ code:200, msg:"注册成功", data:{ username, role } }

## /api/login
- 方法：POST
- 请求体：{ username, password }
- 功能：密码登录，返回用户信息
- 返回 data 示例：{ username, role, total_tests, correct, accuracy, streak }

## /api/change_password
- 方法：POST
- 请求体：{ username, old_password, new_password }
- 功能：修改密码

## /api/admin/users
- 方法：GET
- 参数：role=admin（示例：/api/admin/users?role=admin）
- 功能：管理员查看所有用户

## /api/admin/delete_user
- 方法：POST
- 请求体：{ role: 'admin', username }
- 功能：管理员删除用户（同时删除其记录与其创建的单词）

## /api/word/add
- 方法：POST
- 请求体：{ word, meaning, example, pos, origin, creator, status }
- 功能：添加单条单词（去重：同一创建者与相同英文单词）

## /api/word/import
- 方法：POST
- 请求体：纯文本 CSV 或 JSON { content: string }
- 功能：批量导入 CSV 内容（最多 500 条）。CSV 行格式必须为：
  英文单词,中文释义,例句,词性,语源,创建者用户名,掌握状态
- 返回：{ attempted, added }

## /api/word/list
- 方法：GET
- 参数：username, admin (admin=1 返回全量，如果省略则返回 username 的个人词库)
- 功能：查询词库

## /api/test/random
- 方法：POST
- 请求体：{ username, count }
- 功能：从个人词库随机抽取 count 个单词返回

## /api/test/submit
- 方法：POST
- 请求体：{ username, word, result, time, skipped }
- 功能：提交单词测试结果，保存到 records.csv 并更新 users.csv 的统计

## /api/records
- 方法：GET
- 参数：username（可选）
- 功能：查询测试记录

## /api/game/start
- 方法：POST
- 请求体：{ username, time_limit }
- 功能：开始游戏，返回词池与游戏限时

## /api/game/submit
- 方法：POST
- 请求体：{ username, total_score, chain_len, used_words, duration }
- 功能：保存游戏结果到 game_records.csv

## /api/stats
- 方法：GET
- 参数：username
- 功能：返回用户统计（total_tests, correct, errors, accuracy, avg_time, streak）

---

CSV 文件位置：服务运行目录下的 `data/`（程序会自动创建）。

CSV 模板位于 `docs/csv_templates/`。
