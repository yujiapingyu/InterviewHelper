import pool from './db.js';

// AI操作成本定义（以额度点数计算）
export const AI_COSTS = {
  GENERATE_QUESTIONS: 5,      // 生成问题（每次）
  EVALUATE_ANSWER: 3,         // 评估答案
  FOLLOW_UP_QUESTION: 3,      // 生成追问
  FOLLOW_UP_EVALUATION: 3,    // 评估追问答案
  ANALYZE_VOCABULARY: 2,      // 分析单词
  IMPORT_DOCUMENT: 8,         // 导入文档（提取问题）
  ANALYZE_QUESTION: 5,        // 解析问题（生成完整数据）
  PARSE_RESUME: 10,           // 解析履历书
};

// 额度操作说明（用于前端显示）
export const AI_COST_DESCRIPTIONS = {
  GENERATE_QUESTIONS: '生成面试问题',
  EVALUATE_ANSWER: '评估回答',
  FOLLOW_UP_QUESTION: '生成追问',
  FOLLOW_UP_EVALUATION: '评估追问答案',
  ANALYZE_VOCABULARY: '分析单词',
  IMPORT_DOCUMENT: '导入文档',
  ANALYZE_QUESTION: '解析问题',
  PARSE_RESUME: '解析履历书',
};

/**
 * 检查用户额度是否足够
 * @param {number} userId - 用户ID
 * @param {number} requiredCredits - 需要的额度
 * @returns {Promise<{sufficient: boolean, currentCredits: number}>}
 */
export async function checkCredits(userId, requiredCredits) {
  const [rows] = await pool.query(
    'SELECT ai_credits FROM users WHERE id = ?',
    [userId]
  );
  
  const currentCredits = rows[0]?.ai_credits || 0;
  return {
    sufficient: currentCredits >= requiredCredits,
    currentCredits
  };
}

/**
 * 扣除用户额度
 * @param {number} userId - 用户ID
 * @param {string} operationType - 操作类型
 * @param {number} creditsCost - 消耗额度
 * @param {string} description - 操作描述
 * @returns {Promise<{success: boolean, creditsAfter: number}>}
 */
export async function deductCredits(userId, operationType, creditsCost, description = '') {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 获取当前额度
    const [userRows] = await connection.query(
      'SELECT ai_credits FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    
    const creditsBefore = userRows[0]?.ai_credits || 0;
    
    if (creditsBefore < creditsCost) {
      await connection.rollback();
      return { success: false, creditsAfter: creditsBefore, error: 'Insufficient credits' };
    }
    
    const creditsAfter = creditsBefore - creditsCost;
    
    // 扣除额度
    await connection.query(
      'UPDATE users SET ai_credits = ? WHERE id = ?',
      [creditsAfter, userId]
    );
    
    // 记录日志
    await connection.query(
      `INSERT INTO ai_credits_log (user_id, operation_type, credits_cost, credits_before, credits_after, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, operationType, creditsCost, creditsBefore, creditsAfter, description]
    );
    
    await connection.commit();
    
    return { success: true, creditsAfter };
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 添加用户额度（充值）
 * @param {number} userId - 用户ID
 * @param {number} creditsToAdd - 添加的额度
 * @param {string} description - 描述
 * @param {Object} existingConnection - 可选的现有数据库连接（用于事务）
 * @returns {Promise<{success: boolean, creditsAfter: number}>}
 */
export async function addCredits(userId, creditsToAdd, description = 'Manual recharge', existingConnection = null) {
  const connection = existingConnection || await pool.getConnection();
  const shouldManageTransaction = !existingConnection;
  
  try {
    if (shouldManageTransaction) {
      await connection.beginTransaction();
    }
    
    const [userRows] = await connection.query(
      'SELECT ai_credits FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    
    const creditsBefore = userRows[0]?.ai_credits || 0;
    const creditsAfter = creditsBefore + creditsToAdd;
    
    await connection.query(
      'UPDATE users SET ai_credits = ? WHERE id = ?',
      [creditsAfter, userId]
    );
    
    await connection.query(
      `INSERT INTO ai_credits_log (user_id, operation_type, credits_cost, credits_before, credits_after, description)
       VALUES (?, 'RECHARGE', ?, ?, ?, ?)`,
      [userId, -creditsToAdd, creditsBefore, creditsAfter, description]
    );
    
    if (shouldManageTransaction) {
      await connection.commit();
    }
    
    return { success: true, creditsAfter };
    
  } catch (error) {
    if (shouldManageTransaction) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (shouldManageTransaction) {
      connection.release();
    }
  }
}

/**
 * 获取用户额度使用历史
 * @param {number} userId - 用户ID
 * @param {number} limit - 返回数量
 * @returns {Promise<Array>}
 */
export async function getCreditsHistory(userId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT * FROM ai_credits_log 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ?`,
    [userId, limit]
  );
  
  return rows;
}

/**
 * Express中间件：检查AI操作额度
 * @param {string} operationType - 操作类型（对应AI_COSTS的key）
 */
export function requireCredits(operationType) {
  return async (req, res, next) => {
    const creditsCost = AI_COSTS[operationType];
    
    if (!creditsCost) {
      return res.status(500).json({ error: 'Invalid operation type' });
    }
    
    try {
      const check = await checkCredits(req.userId, creditsCost);
      
      if (!check.sufficient) {
        return res.status(402).json({ 
          error: 'Insufficient AI credits',
          required: creditsCost,
          current: check.currentCredits,
          message: `この操作には${creditsCost}ポイント必要です。現在のポイント: ${check.currentCredits}`
        });
      }
      
      // 将额度信息附加到请求对象
      req.creditsCost = creditsCost;
      req.operationType = operationType;
      
      next();
    } catch (error) {
      console.error('Credits check error:', error);
      return res.status(500).json({ error: 'Failed to check credits' });
    }
  };
}

/**
 * 执行AI操作并自动扣除额度（在操作成功后调用）
 * @param {number} userId - 用户ID
 * @param {string} operationType - 操作类型
 * @param {string} description - 操作描述
 */
export async function chargeCredits(userId, operationType, description = '') {
  const creditsCost = AI_COSTS[operationType];
  const result = await deductCredits(userId, operationType, creditsCost, description);
  
  if (!result.success) {
    throw new Error('Failed to deduct credits: ' + result.error);
  }
  
  return result;
}
