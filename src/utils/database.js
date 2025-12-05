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
