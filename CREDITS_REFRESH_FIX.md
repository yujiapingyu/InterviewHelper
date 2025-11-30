# AI额度实时更新修复

## 问题描述
用户在使用AI功能后，页面Header上显示的额度数字没有实时更新，需要刷新页面才能看到最新的额度。

## 问题原因
前端在调用AI操作API后，虽然后端数据库中的`ai_credits`已经被扣除，但前端的`aiCredits`状态没有同步更新。

## 解决方案

### 1. 添加刷新函数
在`src/App.jsx`中添加了一个专门的辅助函数来刷新用户额度：

```javascript
// Refresh user credits after AI operations
const refreshUserCredits = async () => {
  try {
    const user = await auth.getCurrentUser();
    setAiCredits(user.ai_credits || 0);
  } catch (err) {
    console.error('Failed to refresh credits:', err);
  }
};
```

### 2. 在所有AI操作后调用刷新函数

#### ✅ 已修复的AI操作：

1. **生成面试问题** (`handleGenerateQuestions`)
   - 消耗：5点
   - 位置：质问管理 → AI生成
   ```javascript
   const newQuestions = await questionsAPI.generate(category, count, resumeInfo);
   const updatedQuestions = await questionsAPI.getAll();
   setQuestions(updatedQuestions);
   
   // Refresh credits after AI operation
   await refreshUserCredits();
   
   alert(`${count}個の新しい${category}質問を生成しました！`);
   ```

2. **评估回答（开启对话模式）** (`handleEnableConversationMode`)
   - 消耗：3点
   - 位置：练习页面 → 提交回答后 → 对话モードを有効にする
   ```javascript
   const conversation = await conversationAPI.create(selectedQuestion.id, userAnswer);
   setActiveConversation(conversation);
   setConversationMode(true);
   
   // Refresh credits after AI operation
   await refreshUserCredits();
   ```

3. **生成追问** (`handleRequestFollowUp`)
   - 消耗：3点
   - 位置：对话模式 → 追問を生成
   ```javascript
   const followUp = await conversationAPI.generateFollowUp(activeConversation.id);
   setPendingFollowUp(followUp);
   setFollowUpAnswer('');
   
   // Refresh credits after AI operation
   await refreshUserCredits();
   ```

4. **评估追问答案** (`handleSubmitFollowUpAnswer`)
   - 消耗：3点
   - 位置：对话模式 → 提交追问答案
   ```javascript
   const evaluation = await conversationAPI.answerFollowUp(activeConversation.id, followUpAnswer);
   const updatedConversation = await conversationAPI.getActive(selectedQuestion.id);
   setActiveConversation(updatedConversation);
   
   // Refresh credits after AI operation
   await refreshUserCredits();
   ```

5. **分析单词** (`handleAnalyzeVocabulary`)
   - 消耗：2点
   - 位置：选择日语单词 → 点击搜索图标
   ```javascript
   const analysis = await vocabularyAPI.analyze(selectedText);
   setVocabularyAnalysis(analysis);
   setShowVocabularyPopup(true);
   
   // Refresh credits after AI operation
   await refreshUserCredits();
   ```

6. **解析问题** (`handleAnalyzeQuestion`)
   - 消耗：5点
   - 位置：质问管理 → 质问を解析
   ```javascript
   const updatedQuestion = await questionsAPI.analyzeQuestion(
     analyzingQuestion.id,
     analysisPrompt,
     generateAnswer
   );
   const updatedQuestions = await questionsAPI.getAll();
   setQuestions(updatedQuestions);
   
   // Refresh credits after AI operation
   await refreshUserCredits();
   
   alert('質問の解析が完了しました！');
   ```

#### 📝 暂未实现的AI操作：
- **导入文档** (8点) - 功能还未在前端实现
- **解析履历书** (10点) - 功能还未在前端实现

## 测试步骤

### 测试1：生成问题
1. 登录后，记住当前额度（例如：100点）
2. 进入"質問管理"
3. 点击"AI生成"按钮
4. 选择类别（HR/技術）和数量（3个）
5. 点击"生成"
6. **预期结果**：Header上的额度立即从100点变为95点（无需刷新页面）

### 测试2：对话模式评估
1. 当前额度：95点
2. 在练习页面提交一个回答
3. 点击"対話モードを有効にする"
4. **预期结果**：Header上的额度立即变为92点

### 测试3：生成追问
1. 当前额度：92点
2. 在对话模式中点击"追問を生成"
3. **预期结果**：Header上的额度立即变为89点

### 测试4：单词分析
1. 当前额度：89点
2. 选择一个日语单词
3. 点击搜索图标
4. **预期结果**：Header上的额度立即变为87点

### 测试5：多次连续操作
1. 连续生成3次问题（每次3个）
2. **预期结果**：额度每次减少5点，Header实时更新
3. 打开"AIポイント管理"查看使用履歴
4. **预期结果**：历史记录中有3条"生成面试问题"记录

## 实现细节

### 优点
- ✅ 简单高效，只需要一个小函数
- ✅ 无需修改后端API
- ✅ 用户体验好，实时反馈
- ✅ 代码复用性高，所有AI操作统一调用

### 注意事项
- `refreshUserCredits`是异步函数，使用`await`确保完成后再继续
- 如果刷新失败，只会在控制台输出错误，不影响主流程
- 刷新操作在AI操作成功后进行，不会影响错误处理

### 性能影响
- 每次AI操作额外增加1次API请求（GET /api/auth/me）
- 请求很轻量，只返回用户基本信息
- 相比用户体验提升，性能影响可忽略

## 验证清单

- [x] 添加`refreshUserCredits`辅助函数
- [x] `handleGenerateQuestions`调用刷新
- [x] `handleEnableConversationMode`调用刷新
- [x] `handleRequestFollowUp`调用刷新
- [x] `handleSubmitFollowUpAnswer`调用刷新
- [x] `handleAnalyzeVocabulary`调用刷新
- [x] `handleAnalyzeQuestion`调用刷新
- [x] 代码无语法错误
- [ ] 实际测试所有功能

## 相关文件
- `src/App.jsx` - 主要修改文件
- `src/utils/api.js` - API封装（无需修改）
- `server/api.js` - 后端API（无需修改）

## 后续优化建议

### 方案1：使用WebSocket实时推送
```javascript
// 后端推送额度变化
socket.emit('credits:updated', { userId, newCredits });

// 前端监听
socket.on('credits:updated', (data) => {
  setAiCredits(data.newCredits);
});
```

### 方案2：后端API返回新额度
```javascript
// 修改所有AI端点返回格式
{
  data: { ... },
  credits: {
    before: 100,
    after: 95,
    cost: 5
  }
}

// 前端直接使用返回的额度
const result = await questionsAPI.generate(...);
setAiCredits(result.credits.after);
```

### 方案3：使用React Context
```javascript
// 创建Credits Context
const CreditsContext = React.createContext();

// 在Context中统一管理刷新
const useCredits = () => {
  const { credits, refreshCredits } = useContext(CreditsContext);
  return { credits, refreshCredits };
};
```

目前的实现方案简单可靠，满足需求。如果将来需要更复杂的功能（例如多端同步、实时通知等），可以考虑上述优化方案。
