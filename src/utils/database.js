// Simulated database operations (in real app, these would call backend API)
// For demo purposes, using localStorage with proper structure

const STORAGE_KEYS = {
  CURRENT_USER: 'current_user',
  USERS: 'users',
  QUESTIONS: 'questions',
  PRACTICE_RECORDS: 'practice_records',
  FAVORITES: 'favorites',
  RESUME_INFO: 'resume_info'
};

// Helper to get data from localStorage
const getFromStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting ${key} from storage:`, error);
    return null;
  }
};

// Helper to save data to localStorage
const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to storage:`, error);
  }
};

// User Authentication
export const auth = {
  async register(email, password, username = '') {
    const users = getFromStorage(STORAGE_KEYS.USERS) || [];
    
    if (users.find(u => u.email === email)) {
      throw new Error('Email already exists');
    }

    const newUser = {
      id: Date.now(),
      email,
      password_hash: btoa(password), // Simple encoding (use bcrypt in production)
      username: username || email.split('@')[0],
      avatar_url: '',
      target_language: 'ja',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    users.push(newUser);
    saveToStorage(STORAGE_KEYS.USERS, users);

    const { password_hash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  async login(email, password) {
    const users = getFromStorage(STORAGE_KEYS.USERS) || [];
    const user = users.find(u => u.email === email && u.password_hash === btoa(password));

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const { password_hash, ...userWithoutPassword } = user;
    saveToStorage(STORAGE_KEYS.CURRENT_USER, userWithoutPassword);
    return userWithoutPassword;
  },

  async logout() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  getCurrentUser() {
    return getFromStorage(STORAGE_KEYS.CURRENT_USER);
  },

  async updateProfile(userId, updates) {
    const users = getFromStorage(STORAGE_KEYS.USERS) || [];
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      throw new Error('User not found');
    }

    users[userIndex] = {
      ...users[userIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    saveToStorage(STORAGE_KEYS.USERS, users);

    const { password_hash, ...userWithoutPassword } = users[userIndex];
    saveToStorage(STORAGE_KEYS.CURRENT_USER, userWithoutPassword);
    return userWithoutPassword;
  }
};

// Questions Database
export const questionsDB = {
  async getAll(userId, category = null) {
    const allQuestions = getFromStorage(STORAGE_KEYS.QUESTIONS) || this.getDefaultQuestions();
    
    let filtered = allQuestions.filter(q => 
      q.user_id === null || q.user_id === userId
    );

    if (category) {
      filtered = filtered.filter(q => q.category === category);
    }

    return filtered;
  },

  async getById(id) {
    const questions = getFromStorage(STORAGE_KEYS.QUESTIONS) || this.getDefaultQuestions();
    return questions.find(q => q.id === id);
  },

  async create(userId, questionData) {
    const questions = getFromStorage(STORAGE_KEYS.QUESTIONS) || this.getDefaultQuestions();
    
    const newQuestion = {
      id: Date.now(),
      user_id: userId,
      ...questionData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    questions.push(newQuestion);
    saveToStorage(STORAGE_KEYS.QUESTIONS, questions);
    return newQuestion;
  },

  async update(id, updates) {
    const questions = getFromStorage(STORAGE_KEYS.QUESTIONS) || this.getDefaultQuestions();
    const index = questions.findIndex(q => q.id === id);

    if (index === -1) {
      throw new Error('Question not found');
    }

    questions[index] = {
      ...questions[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    saveToStorage(STORAGE_KEYS.QUESTIONS, questions);
    return questions[index];
  },

  async delete(id) {
    const questions = getFromStorage(STORAGE_KEYS.QUESTIONS) || this.getDefaultQuestions();
    const filtered = questions.filter(q => q.id !== id);
    saveToStorage(STORAGE_KEYS.QUESTIONS, filtered);
  },

  getDefaultQuestions() {
    return [
      {
        id: 1,
        user_id: null,
        category: 'HR',
        question_ja: '自己紹介をお願いします。',
        question_zh: '请做个自我介绍。',
        model_answer_ja: `【Point】私は5年間のソフトウェア開発経験を持つフルスタックエンジニアです。\n\n【Reason】特にWebアプリケーション開発に強みがあり、ReactとNode.jsを用いたプロジェクトを多数手がけてきました。\n\n【Example】前職では、ECサイトのフロントエンド開発をリードし、ユーザー体験の向上により売上を20%増加させました。\n\n【Point】貴社の革新的な技術環境で、さらにスキルを伸ばしたいと考えています。`,
        tips_ja: ['30秒～1分程度で簡潔にまとめる', 'PREP法を使って論理的に構成する', '具体的な数字や成果を入れる', '志望動機につなげる'],
        summary: 'Basic self-introduction question',
        is_ai_generated: false
      },
      {
        id: 2,
        user_id: null,
        category: 'HR',
        question_ja: 'なぜ日本で働きたいと思いますか？',
        question_zh: '为什么想在日本工作？',
        model_answer_ja: `【Point】日本の技術力の高さと、ものづくりへの真摯な姿勢に魅力を感じています。\n\n【Reason】特に品質管理と細部へのこだわりは、グローバルでも高く評価されており、そこから多くを学びたいです。\n\n【Example】以前、日本製のライブラリを使用した際、ドキュメントの充実さとコードの美しさに感動しました。\n\n【Point】このような環境で自分のスキルを磨き、長期的にキャリアを築きたいと考えています。`,
        tips_ja: ['日本や日本企業への敬意を示す', '技術的な理由と文化的な理由をバランスよく', '長期的なキャリアビジョンを示す'],
        summary: 'Motivation for working in Japan',
        is_ai_generated: false
      },
      {
        id: 3,
        user_id: null,
        category: 'Tech',
        question_ja: 'これまでで最も困難だった技術的な課題について教えてください。',
        question_zh: '请说说到目前为止最困难的技术挑战。',
        model_answer_ja: `【Point】最も困難だったのは、レガシーシステムのマイクロサービス化です。\n\n【Reason】10年以上運用されているモノリシックなシステムで、技術的負債が多く、テストカバレッジも低い状態でした。\n\n【Example】段階的なリファクタリング計画を立て、まず重要度の低い機能から分離しました。CI/CDパイプラインを整備し、テストを追加しながら、6ヶ月かけて主要機能を3つのマイクロサービスに分割しました。\n\n【Point】この経験から、大規模なシステム移行における計画性とチームコミュニケーションの重要性を学びました。`,
        tips_ja: ['具体的な技術スタックを明示', '問題解決のプロセスを詳しく説明', '結果と学びを明確に述べる', 'チームワークの要素も含める'],
        summary: 'Most difficult technical challenge',
        is_ai_generated: false
      },
      {
        id: 4,
        user_id: null,
        category: 'Tech',
        question_ja: 'あなたの得意な技術スタックについて教えてください。',
        question_zh: '请介绍你擅长的技术栈。',
        model_answer_ja: `【Point】私はReact、TypeScript、Node.jsを中心としたモダンWeb開発が得意です。\n\n【Reason】過去3年間、これらの技術を使用して複数のプロダクション環境のアプリケーションを開発してきました。\n\n【Example】最近では、Next.jsとPrismaを使用したSaaSプラットフォームを開発し、1000人以上のユーザーに利用されています。パフォーマンス最適化にも注力し、Lighthouseスコアで95点以上を達成しました。\n\n【Point】今後はAWS環境でのインフラ構築スキルも強化していきたいと考えています。`,
        tips_ja: ['主要な技術を3-5つに絞る', '経験年数と実績を具体的に', '今後の学習意欲も示す', 'トレンド技術への関心を示す'],
        summary: 'Strongest technology stack',
        is_ai_generated: false
      }
    ];
  }
};

// Practice Records
export const practiceDB = {
  async create(userId, questionId, userAnswer, answerType, aiFeedback = null) {
    const records = getFromStorage(STORAGE_KEYS.PRACTICE_RECORDS) || [];
    
    const newRecord = {
      id: Date.now(),
      user_id: userId,
      question_id: questionId,
      user_answer: userAnswer,
      answer_type: answerType,
      ai_feedback: aiFeedback,
      created_at: new Date().toISOString()
    };

    records.push(newRecord);
    saveToStorage(STORAGE_KEYS.PRACTICE_RECORDS, records);
    return newRecord;
  },

  async getByUser(userId) {
    const records = getFromStorage(STORAGE_KEYS.PRACTICE_RECORDS) || [];
    return records.filter(r => r.user_id === userId);
  },

  async getByQuestion(userId, questionId) {
    const records = getFromStorage(STORAGE_KEYS.PRACTICE_RECORDS) || [];
    return records.filter(r => r.user_id === userId && r.question_id === questionId);
  }
};

// Favorites
export const favoritesDB = {
  async add(userId, questionId, practiceRecordId = null, notes = '') {
    const favorites = getFromStorage(STORAGE_KEYS.FAVORITES) || [];
    
    // Check if already exists
    const existing = favorites.find(f => f.user_id === userId && f.question_id === questionId);
    if (existing) {
      return existing;
    }

    const newFavorite = {
      id: Date.now(),
      user_id: userId,
      question_id: questionId,
      practice_record_id: practiceRecordId,
      notes,
      created_at: new Date().toISOString()
    };

    favorites.push(newFavorite);
    saveToStorage(STORAGE_KEYS.FAVORITES, favorites);
    return newFavorite;
  },

  async remove(userId, questionId) {
    const favorites = getFromStorage(STORAGE_KEYS.FAVORITES) || [];
    const filtered = favorites.filter(f => !(f.user_id === userId && f.question_id === questionId));
    saveToStorage(STORAGE_KEYS.FAVORITES, filtered);
  },

  async getByUser(userId) {
    const favorites = getFromStorage(STORAGE_KEYS.FAVORITES) || [];
    return favorites.filter(f => f.user_id === userId);
  },

  async isFavorite(userId, questionId) {
    const favorites = getFromStorage(STORAGE_KEYS.FAVORITES) || [];
    return favorites.some(f => f.user_id === userId && f.question_id === questionId);
  }
};

// Resume Info
export const resumeDB = {
  async save(userId, filename, parsedContent, skills, experience, education) {
    const resumes = getFromStorage(STORAGE_KEYS.RESUME_INFO) || [];
    
    const newResume = {
      id: Date.now(),
      user_id: userId,
      filename,
      parsed_content: parsedContent,
      skills,
      experience,
      education,
      created_at: new Date().toISOString()
    };

    resumes.push(newResume);
    saveToStorage(STORAGE_KEYS.RESUME_INFO, resumes);
    return newResume;
  },

  async getByUser(userId) {
    const resumes = getFromStorage(STORAGE_KEYS.RESUME_INFO) || [];
    return resumes.filter(r => r.user_id === userId);
  },

  async delete(id) {
    const resumes = getFromStorage(STORAGE_KEYS.RESUME_INFO) || [];
    const filtered = resumes.filter(r => r.id !== id);
    saveToStorage(STORAGE_KEYS.RESUME_INFO, filtered);
  }
};

// Initialize default questions if not exists
if (!getFromStorage(STORAGE_KEYS.QUESTIONS)) {
  saveToStorage(STORAGE_KEYS.QUESTIONS, questionsDB.getDefaultQuestions());
}
