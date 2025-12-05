-- 删除两个默认问题
DELETE FROM questions 
WHERE question_ja IN ('自己紹介をお願いします。', 'なぜ日本で働きたいと思いますか？')
AND user_id IS NULL;

-- 显示剩余的默认问题（应该为空）
SELECT id, question_ja, category, user_id FROM questions WHERE user_id IS NULL;
