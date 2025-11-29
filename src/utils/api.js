const API_BASE_URL = 'http://localhost:3002/api';

// Get token from localStorage
function getToken() {
  return localStorage.getItem('auth_token');
}

// Set token to localStorage
function setToken(token) {
  localStorage.setItem('auth_token', token);
}

// Remove token from localStorage
function removeToken() {
  localStorage.removeItem('auth_token');
}

// Generic fetch with auth
async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    console.log(`📡 Response from ${url}:`, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
    });

    // Check if response is ok first
    if (!response.ok) {
      // Try to parse error as JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      } else {
        const text = await response.text();
        console.error('Non-JSON error response:', text.substring(0, 200));
        throw new Error('サーバーエラー: JSONレスポンスが期待されましたが、HTMLまたは他の形式を受信しました');
      }
    }

    // For successful responses, check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON success response:', text.substring(0, 200));
      throw new Error('サーバーエラー: JSONレスポンスが期待されましたが、HTMLまたは他の形式を受信しました');
    }

    return response.json();
  } catch (error) {
    // If it's already our custom error, rethrow
    if (error.message.includes('サーバーエラー') || error.message.includes('Request failed')) {
      throw error;
    }
    // Network or parsing errors
    console.error('Fetch error:', error);
    throw new Error(`API エラー: ${error.message}`);
  }
}

// Auth API
export const auth = {
  async register(email, password, username = '') {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      throw new Error('サーバーエラー: 予期しないレスポンス形式');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    setToken(data.token);
    return data.user;
  },

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      throw new Error('サーバーエラー: 予期しないレスポンス形式');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Invalid credentials');
    }

    setToken(data.token);
    return data.user;
  },

  async logout() {
    try {
      await fetchWithAuth('/auth/logout', { method: 'POST' });
    } finally {
      removeToken();
    }
  },

  async getCurrentUser() {
    const token = getToken();
    if (!token) return null;

    try {
      return await fetchWithAuth('/auth/me');
    } catch (error) {
      removeToken();
      return null;
    }
  },
};

// Questions API
export const questionsAPI = {
  async getAll(category = null) {
    const url = category && category !== 'all' ? `/questions?category=${category}` : '/questions';
    return fetchWithAuth(url);
  },

  async getById(id) {
    return fetchWithAuth(`/questions/${id}`);
  },

  async getRandom(category = 'all') {
    const url = category !== 'all' ? `/questions/random?category=${category}` : '/questions/random';
    return fetchWithAuth(url);
  },

  async create(questionData) {
    return fetchWithAuth('/questions', {
      method: 'POST',
      body: JSON.stringify(questionData),
    });
  },

  async update(id, updates) {
    return fetchWithAuth(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(id) {
    return fetchWithAuth(`/questions/${id}`, {
      method: 'DELETE',
    });
  },

  async generate(category = 'HR', count = 3, resumeInfo = null) {
    return fetchWithAuth('/questions/generate', {
      method: 'POST',
      body: JSON.stringify({ category, count, resumeInfo }),
    });
  },
};

// Practice Records API
export const practiceAPI = {
  async create(questionId, userAnswer, answerType, aiFeedback = null) {
    return fetchWithAuth('/practice', {
      method: 'POST',
      body: JSON.stringify({
        question_id: questionId,
        user_answer: userAnswer,
        answer_type: answerType,
        ai_feedback: aiFeedback,
      }),
    });
  },

  async getByQuestion(questionId) {
    return fetchWithAuth(`/practice/question/${questionId}`);
  },
};

// Favorites API
export const favoritesAPI = {
  async getAll() {
    return fetchWithAuth('/favorites');
  },

  async add(questionId, practiceRecordId = null, notes = '', userAnswer = null, aiFeedback = null, aiCorrectedVersion = null, conversationId = null) {
    console.log('📤 favoritesAPI.add called with:', { questionId, userAnswer: userAnswer?.substring(0, 30), aiFeedback: !!aiFeedback, hasConversation: !!conversationId });
    const response = await fetchWithAuth('/favorites', {
      method: 'POST',
      body: JSON.stringify({
        question_id: questionId,
        practice_record_id: practiceRecordId,
        notes,
        user_answer: userAnswer,
        ai_feedback: aiFeedback ? JSON.stringify(aiFeedback) : null,
        ai_corrected_version: aiCorrectedVersion,
        conversation_id: conversationId,
      }),
    });
    console.log('📥 favoritesAPI.add response:', response);
    return response;
  },

  async update(favoriteId, userAnswer = null, aiFeedback = null, aiCorrectedVersion = null, conversationId = null) {
    return fetchWithAuth(`/favorites/${favoriteId}`, {
      method: 'PUT',
      body: JSON.stringify({
        user_answer: userAnswer,
        ai_feedback: aiFeedback ? JSON.stringify(aiFeedback) : null,
        ai_corrected_version: aiCorrectedVersion,
        conversation_id: conversationId,
      }),
    });
  },

  async remove(questionId) {
    return fetchWithAuth(`/favorites/${questionId}`, {
      method: 'DELETE',
    });
  },

  async isFavorite(questionId) {
    const data = await fetchWithAuth(`/favorites/check/${questionId}`);
    return data.isFavorite;
  },
};

// Resume API
export const resumeAPI = {
  async getAll() {
    return fetchWithAuth('/resumes');
  },

  async upload(filename, content) {
    return fetchWithAuth('/resumes', {
      method: 'POST',
      body: JSON.stringify({ filename, content }),
    });
  },

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/resumes/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  },

  async delete(id) {
    return fetchWithAuth(`/resumes/${id}`, {
      method: 'DELETE',
    });
  },
};

export const conversationAPI = {
  async getActive(questionId) {
    return fetchWithAuth(`/conversations/${questionId}`);
  },

  async create(questionId, initialAnswer) {
    return fetchWithAuth('/conversations', {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, initial_answer: initialAnswer }),
    });
  },

  async generateFollowUp(conversationId) {
    return fetchWithAuth(`/conversations/${conversationId}/follow-up`, {
      method: 'POST',
    });
  },

  async answerFollowUp(conversationId, answer) {
    return fetchWithAuth(`/conversations/${conversationId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    });
  },

  async complete(conversationId) {
    console.log('🔄 Completing conversation:', conversationId);
    try {
      const result = await fetchWithAuth(`/conversations/${conversationId}/complete`, {
        method: 'POST',
      });
      console.log('✅ Conversation completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Complete conversation error:', error);
      throw error;
    }
  },
};

// Vocabulary API
export const vocabularyAPI = {
  async analyze(word) {
    return fetchWithAuth('/vocabulary/analyze', {
      method: 'POST',
      body: JSON.stringify({ word }),
    });
  },

  async getAll() {
    return fetchWithAuth('/vocabulary');
  },

  async save(vocabularyData) {
    return fetchWithAuth('/vocabulary', {
      method: 'POST',
      body: JSON.stringify(vocabularyData),
    });
  },

  async delete(id) {
    return fetchWithAuth(`/vocabulary/${id}`, {
      method: 'DELETE',
    });
  },
  
  async getNotionStatus() {
    return fetchWithAuth('/notion/status');
  },
};
