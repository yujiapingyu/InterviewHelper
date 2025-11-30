# 修复报告：Notion API Key 和 AI生成回答质量

## 修复的问题

### 问题1：Notion API Key 被截断保存

**现象：**
- 数据库中的`notion_api_key`被截断为前10个字符（例如：`ntn_194085...`）
- 导致Notion同步功能失效

**根本原因：**
1. API `/api/auth/me`和`/api/auth/settings`为了安全返回截断版本的API Key
2. 前端在打开设置模态框时，将截断的值填充到输入框的`value`中
3. 用户点击保存时，如果没有修改，就会把截断的值保存回数据库

**解决方案：**

#### 1. 前端设置表单改为空值 + placeholder提示
```javascript
// 修改前：预填充截断的值
const handleOpenSettings = () => {
  setSettingsForm({
    notion_api_key: currentUser.notion_api_key || '', // ❌ 会是 "ntn_194085..."
    notion_database_id: currentUser.notion_database_id || '',
    username: currentUser.username || ''
  });
};

// 修改后：不预填充，用placeholder显示
const handleOpenSettings = () => {
  setSettingsForm({
    notion_api_key: '', // ✅ 空值
    notion_database_id: '', // ✅ 空值
    username: currentUser.username || ''
  });
  setShowApiKey(false);
  setShowSettingsModal(true);
};
```

#### 2. 输入框使用placeholder显示当前配置状态
```jsx
<input
  type={showApiKey ? "text" : "password"}
  value={settingsForm.notion_api_key}
  onChange={(e) => setSettingsForm({ ...settingsForm, notion_api_key: e.target.value })}
  placeholder={currentUser.notion_configured 
    ? `現在の設定: ${currentUser.notion_api_key}` 
    : "secret_xxxxxxxxxxxxxxxxx"}
/>

{currentUser.notion_configured && (
  <p className="text-xs text-gray-500 mt-1">
    💡 空欄のまま保存すると既存の設定を保持します。変更する場合は新しいキーを入力してください。
  </p>
)}
```

#### 3. 添加显示/隐藏API Key按钮
```jsx
// 新增状态
const [showApiKey, setShowApiKey] = useState(false);

// 输入框添加Eye/EyeOff按钮
<div className="relative">
  <input type={showApiKey ? "text" : "password"} ... />
  <button onClick={() => setShowApiKey(!showApiKey)}>
    {showApiKey ? <EyeOff /> : <Eye />}
  </button>
</div>
```

#### 4. 保存时只发送修改过的字段
```javascript
const handleSaveSettings = async () => {
  const payload = {};
  
  if (settingsForm.username && settingsForm.username !== currentUser.username) {
    payload.username = settingsForm.username;
  }
  
  // 只有用户输入了新值才更新
  if (settingsForm.notion_api_key && settingsForm.notion_api_key.trim()) {
    payload.notion_api_key = settingsForm.notion_api_key.trim();
  }
  
  if (settingsForm.notion_database_id && settingsForm.notion_database_id.trim()) {
    payload.notion_database_id = settingsForm.notion_database_id.trim();
  }
  
  if (Object.keys(payload).length === 0) {
    alert('変更がありません');
    return;
  }
  
  await auth.updateSettings(payload);
};
```

### 问题2：AI生成的回答质量差，过多停顿词

**现象：**
生成的回答类似这样：
```
"あの、私は、あの、チームとして、あの、協力して、あの、何かを、あの、成し遂げる、
そういう、あの、文化が、あの、いいなと、思っています。あの、お互いを、あの、
尊重し合って、あの、フィードバックも、あの、オープンに、あの、伝え合える..."
```

**问题分析：**
- 原prompt强调"EXTREMELY CONVERSATIONAL"导致过度使用填充词
- "あの"出现频率过高（几乎每句话都有2-3个）
- 句子过于碎片化，不符合PREP结构
- 听起来像初学者而不是N2-N1水平

**解决方案：**

修改`server/gemini.js`中的`generateQuestionAnalysis`函数的prompt：

```javascript
// 修改前的prompt（会产生过多停顿词）
For model_answer_ja, make it EXTREMELY CONVERSATIONAL and REAL:
- Use VERY SHORT sentences (one idea per sentence)
- Add realistic hesitations: "そうですね..."、"えーと"、"まあ"
- Use simple connectors: ～んです、～んですけど、～ので、～から
- Include thinking phrases: "つまり"、"要するに"、"例えば"
- Use casual business words: やっぱり、ちょっと、結構、なんか
- Repeat important points (people do this naturally)

// 修改后的prompt（更自然流畅）
For model_answer_ja, follow PREP structure and make it NATURAL and FLUENT:

**CRITICAL RULES - MUST FOLLOW:**
1. Use PREP structure: 【Point】→【Reason】→【Example】→【Point】
2. Each section should be 2-3 sentences maximum
3. AVOID excessive use of "あの" (use it SPARINGLY, max 1-2 times in entire answer)
4. AVOID choppy, overly-fragmented sentences
5. Use natural connectors: ～んです、～ので、～から、～けど
6. Sound CONVERSATIONAL but FLUENT (like a competent speaker, NOT a beginner)
7. Use thinking phrases MODERATELY: そうですね (only at start), 例えば、つまり
8. NO excessive repetition of filler words

**Style Guide:**
- Opening: Start with "そうですね" ONCE if needed, then dive into Point
- Point: Clear, direct statement (1-2 sentences)
- Reason: Explain why (2-3 sentences, use ～ので、～から)
- Example: Concrete example (2-3 sentences, start with "例えば")
- Point: Summarize (1-2 sentences)
- Use やっぱり、ちょっと SPARINGLY (1-2 times total)
- Sound like a competent N2-N1 level speaker (fluent and clear)

**BAD Example (too many fillers):**
"あの、私は、あの、チームとして、あの、協力して、あの、何かを、あの、成し遂げる..."

**GOOD Example (natural and fluent):**
"私はチームで協力して成果を上げることを大切にしています。なぜなら、一人では限界が
あるので、お互いの強みを活かすことで、より良い結果が出せるからです。"
```

### 新生成回答示例

**修改后生成的回答应该类似：**

```
【Point】
私はチームで協力して成果を上げることを大切にしています。

【Reason】
なぜなら、一人では限界があるので、お互いの強みを活かすことで、より良い結果が
出せるからです。また、メンバー同士が尊重し合える環境では、オープンなフィードバック
も可能になり、チーム全体が成長できます。

【Example】
例えば、前職では新機能の開発プロジェクトで、フロントエンドとバックエンドの
エンジニアが密接に協力しました。毎日短いミーティングを行い、課題を共有することで、
予定より早くリリースできました。

【Point】
このように、チームワークを大切にする文化で働きたいと思っています。
```

## 测试验证

### Notion API Key 修复测试

1. **测试场景1：首次配置Notion**
   ```
   1. 打开设置
   2. 输入框应该为空，placeholder显示"secret_xxxxxxxxxxxxxxxxx"
   3. 输入完整的API Key和Database ID
   4. 保存
   5. 数据库中应该保存完整的值
   ```

2. **测试场景2：修改已有配置**
   ```
   1. 已配置Notion的用户打开设置
   2. 输入框为空，placeholder显示"現在の設定: ntn_194085..."
   3. 输入新的API Key
   4. 保存
   5. 数据库中应该更新为新的完整值
   ```

3. **测试场景3：不修改直接保存**
   ```
   1. 打开设置
   2. 不输入任何内容
   3. 点击保存
   4. 提示"変更がありません"
   5. 数据库中的值保持不变（不会被截断）
   ```

4. **测试场景4：显示/隐藏API Key**
   ```
   1. 输入API Key（默认显示为***）
   2. 点击眼睛图标
   3. API Key显示为明文
   4. 再次点击，恢复为***
   ```

### AI生成回答测试

1. **生成问题的标准答案**
   ```
   1. 在质问管理页面，选择任意问题
   2. 点击"質問を解析"
   3. 勾选"模範回答も生成する"
   4. 点击"解析を開始"
   5. 查看生成的model_answer_ja
   6. 验证：
      - ✅ 是否遵循PREP结构（Point → Reason → Example → Point）
      - ✅ "あの"出现次数 ≤ 2次
      - ✅ 句子流畅，不是过度碎片化
      - ✅ 听起来像N2-N1水平，而不是初学者
   ```

2. **对比示例**
   ```
   ❌ 修复前（过多停顿词）：
   "あの、私は、あの、チームとして、あの、協力して、あの、何かを、あの、
   成し遂げる、そういう、あの、文化が、あの、いいなと、思っています。"
   
   ✅ 修复后（自然流畅）：
   "私はチームで協力して成果を上げることを大切にしています。なぜなら、
   一人では限界があるので、お互いの強みを活かすことで、より良い結果が
   出せるからです。"
   ```

## 数据库修复（如果已经有截断的数据）

如果数据库中已经有被截断的API Key，需要用户重新输入：

```sql
-- 查看哪些用户的API Key被截断
SELECT id, email, 
  CASE 
    WHEN notion_api_key LIKE '%...' THEN '截断'
    ELSE '正常'
  END as status,
  notion_api_key
FROM users 
WHERE notion_api_key IS NOT NULL;

-- 清除被截断的API Key（让用户重新输入）
UPDATE users 
SET notion_api_key = NULL, notion_database_id = NULL
WHERE notion_api_key LIKE '%...';
```

## 相关文件

- ✅ `src/App.jsx` - 设置模态框UI和保存逻辑
- ✅ `server/gemini.js` - AI生成回答的prompt
- ✅ `server/api.js` - API端点（无需修改）

## 后续建议

### Notion配置安全性增强
1. **后端加密存储API Key**
   ```javascript
   // 使用AES-256加密
   import crypto from 'crypto';
   
   const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32字节密钥
   
   function encryptApiKey(apiKey) {
     const iv = crypto.randomBytes(16);
     const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
     let encrypted = cipher.update(apiKey, 'utf8', 'hex');
     encrypted += cipher.final('hex');
     return iv.toString('hex') + ':' + encrypted;
   }
   
   function decryptApiKey(encrypted) {
     const parts = encrypted.split(':');
     const iv = Buffer.from(parts[0], 'hex');
     const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
     let decrypted = decipher.update(parts[1], 'hex', 'utf8');
     decrypted += decipher.final('utf8');
     return decrypted;
   }
   ```

2. **添加API Key验证**
   ```javascript
   // 保存前验证Notion API Key格式
   if (notion_api_key && !notion_api_key.startsWith('secret_') && !notion_api_key.startsWith('ntn_')) {
     throw new Error('Invalid Notion API Key format');
   }
   ```

### AI生成质量监控
1. **添加回答质量评分**
   - 统计"あの"出现次数
   - 检查PREP结构完整性
   - 计算句子平均长度

2. **用户反馈机制**
   - 允许用户对生成的回答评分
   - 收集反馈优化prompt

## 修复完成清单

- [x] Notion API Key显示/隐藏按钮
- [x] 设置表单使用空值+placeholder
- [x] 保存时只发送修改的字段
- [x] 添加用户提示说明
- [x] 改进AI生成回答的prompt
- [x] 减少停顿词和填充词
- [x] 强化PREP结构
- [x] 代码无语法错误
- [ ] 实际测试所有场景
- [ ] 数据库清理截断的API Key
