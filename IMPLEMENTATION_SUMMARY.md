# 新功能实现总结

## 1. Notion配置移至用户级别 ✅

### 变更内容
- **之前**：Notion API Key和Database ID配置在全局`.env`文件，所有用户共享
- **现在**：每个用户在个人设置中配置独立的Notion集成

### 实现细节
- 数据库：`users`表新增`notion_api_key`和`notion_database_id`字段
- API端点：`PUT /api/auth/settings` - 更新用户Notion配置
- 后端逻辑：
  - `authenticate`中间件现在返回`req.userNotionConfig`
  - 所有Notion相关函数接受用户配置参数
  - `isNotionEnabled()`, `syncVocabularyToNotion()`, `deleteVocabularyFromNotion()`更新为接受用户配置

### 优势
- ✅ 数据隔离：每个用户的单词保存到自己的Notion数据库
- ✅ 隐私保护：不同用户间数据完全隔离
- ✅ 灵活性：用户可自由选择是否启用Notion同步

---

## 2. 严格鉴权模式 ✅

### 现状分析
- **已实现**：所有重要端点都使用`authenticate`中间件
- **Session管理**：基于token的会话系统，存储在`sessions`表
- **数据隔离**：所有查询都带`user_id`条件

### 端点保护清单
✅ 所有问题相关端点（GET/POST/PUT/DELETE /api/questions/*）
✅ 所有练习记录端点（/api/practice/*）
✅ 所有收藏端点（/api/favorites/*）
✅ 所有履历书端点（/api/resumes/*）
✅ 所有对话端点（/api/conversations/*）
✅ 所有单词本端点（/api/vocabulary/*）
✅ 用户设置端点（/api/auth/settings, /api/auth/me）
✅ AI额度端点（/api/credits/*）

### 无需登录的端点（公开）
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/credits/costs` - 查看AI操作价格表（公开信息）

---

## 3. AI额度管理系统 ✅

### 系统架构

#### 3.1 数据库表
1. **users表新增字段**：
   - `ai_credits INT DEFAULT 100` - 用户当前额度
   - 新用户注册时自动赋予100点

2. **ai_credits_log表**（新建）：
   ```sql
   - id: 日志ID
   - user_id: 用户ID
   - operation_type: 操作类型（如'GENERATE_QUESTIONS'）
   - credits_cost: 消耗点数
   - credits_before: 操作前余额
   - credits_after: 操作后余额
   - description: 操作描述
   - created_at: 创建时间
   ```

#### 3.2 额度定义（`server/credits.js`）
```javascript
export const AI_COSTS = {
  GENERATE_QUESTIONS: 5,      // 生成问题
  EVALUATE_ANSWER: 3,         // 评估答案
  FOLLOW_UP_QUESTION: 3,      // 生成追问
  FOLLOW_UP_EVALUATION: 3,    // 评估追问答案
  ANALYZE_VOCABULARY: 2,      // 分析单词
  IMPORT_DOCUMENT: 8,         // 导入文档
  ANALYZE_QUESTION: 5,        // 解析问题
  PARSE_RESUME: 10,           // 解析履历书
};
```

#### 3.3 核心功能
- `checkCredits(userId, requiredCredits)` - 检查额度是否足够
- `deductCredits(userId, operationType, creditsCost, description)` - 扣除额度（带事务）
- `addCredits(userId, creditsToAdd, description)` - 添加额度（充值）
- `getCreditsHistory(userId, limit)` - 获取消费历史
- `requireCredits(operationType)` - Express中间件，检查额度
- `chargeCredits(userId, operationType, description)` - 操作成功后扣费

#### 3.4 API端点

**查询额度信息**：
- `GET /api/credits/costs` - 获取所有AI操作的价格表（无需登录）
- `GET /api/credits/history` - 获取当前用户的消费历史

**充值**：
- `POST /api/credits/recharge` - 充值额度
  ```json
  {
    "amount": 100,
    "payment_method": "manual"
  }
  ```

**用户信息**：
- `GET /api/auth/me` - 返回用户信息时包含`ai_credits`字段

#### 3.5 保护的AI端点

所有AI操作端点已添加额度检查：

1. **POST /api/questions/generate** - 生成问题（5点）
   - 中间件：`requireCredits('GENERATE_QUESTIONS')`
   - 成功后：`chargeCredits()`

2. **POST /api/questions/import** - 导入文档（8点）
   - 中间件：`requireCredits('IMPORT_DOCUMENT')`
   - 成功后：`chargeCredits()`

3. **POST /api/questions/:id/analyze** - 解析问题（5点）
   - 中间件：`requireCredits('ANALYZE_QUESTION')`
   - 成功后：`chargeCredits()`

4. **POST /api/conversations** - 评估初始答案（3点）
   - 中间件：`requireCredits('EVALUATE_ANSWER')`
   - 成功后：`chargeCredits()`

5. **POST /api/conversations/:id/follow-up** - 生成追问（3点）
   - 中间件：`requireCredits('FOLLOW_UP_QUESTION')`
   - 成功后：`chargeCredits()`

6. **POST /api/conversations/:id/answer** - 评估追问答案（3点）
   - 中间件：`requireCredits('FOLLOW_UP_EVALUATION')`
   - 成功后：`chargeCredits()`

7. **POST /api/vocabulary/analyze** - 分析单词（2点）
   - 中间件：`requireCredits('ANALYZE_VOCABULARY')`
   - 成功后：`chargeCredits()`

8. **POST /api/resumes** - 解析履历书（10点）
   - 中间件：`requireCredits('PARSE_RESUME')`
   - 成功后：`chargeCredits()`

9. **POST /api/resumes/upload** - 上传履历书文件（10点）
   - 中间件：`requireCredits('PARSE_RESUME')`
   - 成功后：`chargeCredits()`

#### 3.6 额度不足处理

当用户额度不足时：
- **状态码**：402 Payment Required
- **响应**：
  ```json
  {
    "error": "Insufficient AI credits",
    "required": 5,
    "current": 2,
    "message": "この操作には5ポイント必要です。現在のポイント: 2"
  }
  ```
- **用户体验**：前端显示友好提示，引导充值

#### 3.7 前端API支持

新增`creditsAPI`（`src/utils/api.js`）：
```javascript
export const creditsAPI = {
  async getCosts() { ... },      // 获取价格表
  async getHistory() { ... },     // 获取消费历史
  async recharge(amount, paymentMethod) { ... }  // 充值
};
```

---

## 4. 定价与成本分析 ✅

### 成本分析文档
详见 `PRICING_ANALYSIS.md`

### 关键数据
- **Gemini 2.0 Flash Lite成本**：
  - Input: $0.075 / 1M tokens
  - Output: $0.30 / 1M tokens
  - 免费配额：每日1500次请求

- **平均操作成本**：约 $0.0004 USD
- **100点实际成本**：约 $0.01 USD

### 推荐充值方案
| 金额 | 额度 | 赠送 | 总额度 |
|-----|------|------|--------|
| ¥1 | 100点 | 0点 | 100点 |
| ¥5 | 500点 | 100点 | 600点 |
| ¥10 | 1000点 | 300点 | 1300点 |
| ¥30 | 3000点 | 1200点 | 4200点 |
| ¥50 | 5000点 | 2500点 | 7500点 |

### 利润率
- ¥1 = 100点 → 实际成本¥0.0072 → **利润率：~13800%**
- ¥10 = 1300点 → 实际成本¥0.094 → **利润率：~10500%**

**结论**：即使给用户大量免费额度（100点），成本依然极低（¥0.0072），完全可承受。

---

## 5. 数据库迁移 ✅

### 迁移脚本
`scripts/migrate-credits.js`

### 执行方式
```bash
npm run db:migrate
```

### 迁移内容
1. 添加`users.ai_credits`字段（默认100）
2. 添加`users.notion_api_key`字段
3. 添加`users.notion_database_id`字段
4. 创建`ai_credits_log`表
5. 为现有用户赋予100点初始额度

### 执行结果
```
✅ ai_credits column added
✅ notion_api_key column added
✅ notion_database_id column added
✅ ai_credits_log table created
✅ Updated 0 users (因为是新建数据库，暂无用户)
```

---

## 6. 文档更新 ✅

### 更新的文件
1. **README.md**：
   - 新增"AI额度管理系统"说明
   - 更新Notion集成说明（用户级配置）
   - 添加数据库迁移说明
   - 更新注意事项

2. **PRICING_ANALYSIS.md**（新建）：
   - 详细成本分析
   - Token消耗预估
   - 充值方案建议
   - 利润率计算
   - 成本保护策略

3. **package.json**：
   - 添加`db:migrate`脚本

---

## 7. 开发测试步骤

### 测试额度系统

#### 1. 查看当前额度
```bash
# 登录后，查看用户信息
curl -H "Authorization: Bearer <token>" http://localhost:3002/api/auth/me
# 响应包含 "ai_credits": 100
```

#### 2. 测试AI操作扣费
```bash
# 生成问题（消耗5点）
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"category":"HR","count":1}' \
  http://localhost:3002/api/questions/generate

# 再次查看额度，应该变为95点
```

#### 3. 测试额度不足
```bash
# 手动将用户额度设为1点
mysql> UPDATE users SET ai_credits = 1 WHERE id = <user_id>;

# 尝试生成问题（需要5点），应该返回402错误
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"category":"HR","count":1}' \
  http://localhost:3002/api/questions/generate

# 响应：
# {
#   "error": "Insufficient AI credits",
#   "required": 5,
#   "current": 1,
#   "message": "この操作には5ポイント必要です。現在のポイント: 1"
# }
```

#### 4. 测试充值
```bash
# 充值100点
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount":100}' \
  http://localhost:3002/api/credits/recharge

# 响应：
# {
#   "success": true,
#   "credits_added": 100,
#   "credits_after": 101,
#   "message": "100ポイントをチャージしました"
# }
```

#### 5. 查看消费历史
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3002/api/credits/history

# 响应：历史记录数组
# [
#   {
#     "id": 1,
#     "user_id": 1,
#     "operation_type": "GENERATE_QUESTIONS",
#     "credits_cost": 5,
#     "credits_before": 100,
#     "credits_after": 95,
#     "description": "Generated 1 HR questions",
#     "created_at": "2025-11-30T12:00:00.000Z"
#   }
# ]
```

### 测试Notion用户配置

#### 1. 更新用户Notion配置
```bash
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notion_api_key": "secret_xxxxx",
    "notion_database_id": "xxxxx-xxxxx-xxxxx"
  }' \
  http://localhost:3002/api/auth/settings

# 响应：更新后的用户信息（包含notion_configured: true）
```

#### 2. 保存单词并同步Notion
```bash
# 保存单词（会自动使用用户的Notion配置同步）
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "word": "頑張る",
    "translation": "加油，努力",
    "explanation": "表示努力做某事"
  }' \
  http://localhost:3002/api/vocabulary

# 如果Notion配置正确，响应包含 "synced_to_notion": true
```

---

## 8. 后续TODO

### 前端UI实现（尚未完成）
- [ ] 用户设置页面（Notion配置表单）
- [ ] 额度显示组件（导航栏显示余额）
- [ ] 额度不足提示（402错误处理）
- [ ] 充值页面/弹窗
- [ ] 消费历史页面
- [ ] AI操作说明（每个操作旁边显示消耗点数）

### 支付集成（未来扩展）
- [ ] 接入支付宝/微信支付
- [ ] 充值订单记录
- [ ] 自动充值成功回调
- [ ] 充值优惠活动

### 运营功能
- [ ] 管理后台（查看用户额度、充值记录）
- [ ] 促销码/优惠券系统
- [ ] VIP会员（月费制）
- [ ] 赠送额度活动

---

## 9. 重要提醒

### 安全性
1. **Notion密钥存储**：用户的Notion API Key存储在数据库中，建议：
   - 生产环境使用加密存储（AES-256等）
   - 传输时使用HTTPS
   - 定期审计访问日志

2. **额度防刷**：
   - 已实现事务保证原子性
   - 建议添加速率限制（每小时/每天最大操作次数）
   - 监控异常高频用户

3. **API密钥保护**：
   - Gemini API Key仍在`.env`中（全局共享）
   - 确保`.env`不提交到Git
   - 生产环境使用环境变量或密钥管理服务

### 成本控制
1. **免费额度利用**：Gemini 2.0 Flash Lite每日免费1500次请求
2. **缓存策略**：对重复请求（如相同问题的AI回答）可以缓存
3. **降级方案**：额度不足时，用户仍可编辑问题和练习（不依赖AI）

---

## 10. 完成清单

✅ 数据库架构更新（ai_credits, notion配置字段）
✅ AI额度管理核心逻辑（credits.js）
✅ 所有AI端点添加额度检查
✅ Notion配置移至用户级别
✅ 用户设置API端点
✅ 充值API端点
✅ 前端API封装（creditsAPI）
✅ 数据库迁移脚本
✅ 成本与定价分析文档
✅ README文档更新
✅ 测试验证（迁移成功）

**状态**：后端功能100%完成，前端UI待实现。
