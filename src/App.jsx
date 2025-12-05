import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { 
  User, LogIn, LogOut, BookOpen, Mic, FileText, Star, 
  PlusCircle, Edit, Trash2, Play, ChevronRight, Home,
  Upload, RefreshCw, Check, X, Loader2, MessageSquare, Shuffle, Send, Book, Search, RotateCcw, Eye, EyeOff,
  FileUp, Sparkles, Coins, Settings, CreditCard, History
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { auth, questionsAPI, practiceAPI, favoritesAPI, resumeAPI, conversationAPI, vocabularyAPI, creditsAPI } from './utils/api';
import { getAIFeedback, startSpeechRecognition } from './utils/gemini';
import AdminPanel from './AdminPanel';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [initializing, setInitializing] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login/Register state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Practice state
  const [userAnswer, setUserAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  // Conversation state (follow-up Q&A)
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationMode, setConversationMode] = useState(false);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [pendingFollowUp, setPendingFollowUp] = useState(null);

  // Vocabulary state (word selection)
  const [selectedText, setSelectedText] = useState('');
  const [vocabularyAnalysis, setVocabularyAnalysis] = useState(null);
  const [showVocabularyPopup, setShowVocabularyPopup] = useState(false);
  const [vocabularyNotes, setVocabularyNotes] = useState([]);
  const [floatingSearchPos, setFloatingSearchPos] = useState(null);
  const [notionEnabled, setNotionEnabled] = useState(false);
  
  // Vocabulary review mode
  const [reviewMode, setReviewMode] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  
  // Vocabulary editing
  const [editingVocabulary, setEditingVocabulary] = useState(null);
  const [showVocabEditModal, setShowVocabEditModal] = useState(false);
  const [vocabularyForm, setVocabularyForm] = useState({
    word: '',
    translation: '',
    explanation: '',
    example_sentences: []
  });
  
  // Professional vocabulary test for new users
  const [showVocabTest, setShowVocabTest] = useState(false);
  const [vocabTestWords, setVocabTestWords] = useState([]);
  const [vocabTestResults, setVocabTestResults] = useState({});
  const [isProcessingVocabTest, setIsProcessingVocabTest] = useState(false);

  // Question management
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    category: 'HR',
    question_ja: '',
    question_zh: '',
    model_answer_ja: '',
    tips_ja: [],
    summary: ''
  });

  // Document import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // Question analysis state
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analyzingQuestion, setAnalyzingQuestion] = useState(null);
  const [analysisPrompt, setAnalysisPrompt] = useState('');
  const [generateAnswer, setGenerateAnswer] = useState(true);

  // Question generation modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateCategory, setGenerateCategory] = useState('HR');
  const [generateCount, setGenerateCount] = useState(3);

  // Resume state
  const [resumes, setResumes] = useState([]);

  // Credits state
  const [aiCredits, setAiCredits] = useState(0);
  const [creditsCosts, setCreditsCosts] = useState([]);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [creditsHistory, setCreditsHistory] = useState([]);

  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    notion_api_key: '',
    notion_database_id: '',
    username: ''
  });

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Question expand state
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());

  // Search state
  const [searchKeyword, setSearchKeyword] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [vocabularyPage, setVocabularyPage] = useState(1);
  const [questionsTotal, setQuestionsTotal] = useState(0);
  const [favoritesTotal, setFavoritesTotal] = useState(0);
  const [vocabularyTotal, setVocabularyTotal] = useState(0);
  const [questionsPerPage, setQuestionsPerPage] = useState(10);
  const [favoritesPerPage, setFavoritesPerPage] = useState(10);
  const [vocabularyPerPage, setVocabularyPerPage] = useState(10);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const loadCurrentUser = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        // Set view based on user role
        if (user.role === 'admin') {
          setCurrentView('admin');
        } else {
          setCurrentView('home');
        }
        await loadUserData();
      }
    } catch (err) {
      console.error('Error loading user:', err);
    } finally {
      setInitializing(false);
    }
  };

  const loadUserData = async () => {
    try {
      const [questionsData, favoritesData, resumesData, vocabularyData, notionStatus, costsData] = await Promise.all([
        questionsAPI.getAll(null, currentPage, questionsPerPage, searchKeyword),
        favoritesAPI.getAll(favoritesPage, favoritesPerPage),
        resumeAPI.getAll(),
        vocabularyAPI.getAll(vocabularyPage, vocabularyPerPage),
        vocabularyAPI.getNotionStatus(),
        creditsAPI.getCosts()
      ]);
      
      setQuestions(questionsData.questions || questionsData);
      setQuestionsTotal(questionsData.total || (questionsData.questions || questionsData).length);
      setFavorites(favoritesData.favorites || favoritesData);
      setFavoritesTotal(favoritesData.total || (favoritesData.favorites || favoritesData).length);
      setResumes(resumesData);
      setVocabularyNotes(vocabularyData.notes || vocabularyData);
      setVocabularyTotal(vocabularyData.total || (vocabularyData.notes || vocabularyData).length);
      setNotionEnabled(notionStatus.enabled);
      setCreditsCosts(costsData);
      
      // Load user info to get credits
      const user = await auth.getCurrentUser();
      if (user) {
        setAiCredits(user.ai_credits || 0);
        setCurrentUser(user);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await auth.login(email, password);
      setCurrentUser(user);
      
      // Check if user is admin
      if (user.role === 'admin') {
        setCurrentView('admin');
      } else {
        setCurrentView('home');
      }
      
      await loadUserData();
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await auth.register(email, password, username, verificationCode);
      setCurrentUser(user);
      setCurrentView('home');
      await loadUserData();
      setEmail('');
      setPassword('');
      setUsername('');
      setVerificationCode('');
      setCodeSent(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await auth.logout();
    setCurrentUser(null);
    setCurrentView('login');
    setQuestions([]);
    setFavorites([]);
    setSelectedQuestion(null);
  };

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await auth.sendVerificationCode(email);
      setCodeSent(true);
      setCountdown(60);
      alert('認証コードを送信しました。メールをご確認ください。');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Refresh user credits after AI operations
  const refreshUserCredits = async () => {
    try {
      const user = await auth.getCurrentUser();
      setAiCredits(user.ai_credits || 0);
    } catch (err) {
      console.error('Failed to refresh credits:', err);
    }
  };

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  // Toggle question expand/collapse
  const toggleQuestionExpand = (questionId) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  // Settings handlers
  const handleOpenSettings = () => {
    setSettingsForm({
      notion_api_key: '', // Don't prefill truncated value
      notion_database_id: '', // Don't prefill truncated value  
      username: currentUser.username || ''
    });
    setShowApiKey(false); // Reset visibility
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setError('');
    try {
      // Only send fields that have been modified
      const payload = {};
      
      if (settingsForm.username && settingsForm.username !== currentUser.username) {
        payload.username = settingsForm.username;
      }
      
      // Only update Notion keys if user has entered something
      if (settingsForm.notion_api_key && settingsForm.notion_api_key.trim()) {
        payload.notion_api_key = settingsForm.notion_api_key.trim();
      }
      
      if (settingsForm.notion_database_id && settingsForm.notion_database_id.trim()) {
        payload.notion_database_id = settingsForm.notion_database_id.trim();
      }
      
      if (Object.keys(payload).length === 0) {
        alert('変更がありません');
        setShowSettingsModal(false);
        return;
      }
      
      const updatedUser = await auth.updateSettings(payload);
      setCurrentUser(updatedUser);
      setNotionEnabled(updatedUser.notion_configured);
      setShowSettingsModal(false);
      alert('設定を保存しました！');
    } catch (err) {
      setError(err.message);
      alert('設定の保存に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Credits handlers
  const handleOpenCredits = async () => {
    setLoading(true);
    try {
      const history = await creditsAPI.getHistory();
      setCreditsHistory(history);
      setShowCreditsModal(true);
    } catch (err) {
      alert('履歴の読み込みに失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async (amount) => {
    setLoading(true);
    setError('');
    try {
      const result = await creditsAPI.recharge(amount);
      setAiCredits(result.credits_after);
      showToast(result.message, 'success');
      setShowRechargeModal(false);
      
      // Reload user data
      await loadUserData();
    } catch (err) {
      setError(err.message);
      showToast('充值失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemCard = async (cardCode) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002/api'}/cards/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ card_code: cardCode })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Card redemption failed');
      }

      const data = await response.json();
      
      showToast(`充值成功！获得 ${data.credits} 点积分`, 'success');
      
      // Refresh user info and credits
      const user = await auth.getCurrentUser();
      if (user) {
        setAiCredits(user.ai_credits || 0);
        setCurrentUser(user);
      }
      
      setLoading(false);
      setShowRechargeModal(false);
    } catch (err) {
      setError(err.message);
      showToast('兑换失败: ' + err.message, 'error');
      setLoading(false);
    }
  };

  const startPractice = (question) => {
    // Check if this question is favorited and has saved answer
    const favorite = favorites.find(f => f.question_id === question.id);
    
    if (favorite && favorite.user_answer) {
      // Ask user if they want to load previous answer or start fresh
      const loadPrevious = window.confirm(
        'この問題には保存された回答があります。\n\n'
        + 'OK: 前回の回答を読み込む\n'
        + 'キャンセル: 新しく始める'
      );
      
      if (loadPrevious) {
        setUserAnswer(favorite.user_answer || '');
        if (favorite.ai_feedback) {
          try {
            setAiFeedback(JSON.parse(favorite.ai_feedback));
          } catch (e) {
            setAiFeedback(null);
          }
        } else {
          setAiFeedback(null);
        }
      } else {
        setUserAnswer('');
        setAiFeedback(null);
      }
    } else {
      setUserAnswer('');
      setAiFeedback(null);
    }
    
    setSelectedQuestion(question);
    setShowModelAnswer(false);
    setCurrentView('practice');
  };

  const startRandomPractice = async (category) => {
    setLoading(true);
    setError('');
    try {
      const question = await questionsAPI.getRandom(category);
      if (question) {
        startPractice(question);
      } else {
        setError('この カテゴリに質問がありません');
      }
    } catch (err) {
      setError('ランダム質問の取得に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipToNext = async () => {
    if (!selectedQuestion) return;
    setLoading(true);
    setError('');
    setUserAnswer('');
    setAiFeedback(null);
    try {
      const question = await questionsAPI.getRandom(selectedQuestion.category);
      if (question) {
        setSelectedQuestion(question);
        setCurrentView('practice');
      } else {
        setError('このカテゴリに質問がありません');
      }
    } catch (err) {
      setError('次の質問の取得に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = async () => {
    try {
      const recognition = startSpeechRecognition(
        (finalTranscript, interimTranscript) => {
          // If in conversation mode with pending follow-up, set follow-up answer
          if (conversationMode && pendingFollowUp && !pendingFollowUp.evaluation) {
            setFollowUpAnswer(finalTranscript);
          } else {
            // Otherwise set user answer
            setUserAnswer(finalTranscript);
          }
        },
        (error) => {
          setError('音声認識エラー: ' + error.message);
          setIsRecording(false);
          setMediaRecorder(null);
        }
      );

      setMediaRecorder(recognition); // Store recognition object for cleanup
      setIsRecording(true);
    } catch (err) {
      setError('音声認識の開始に失敗しました: ' + err.message);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop(); // Stop speech recognition
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      setError('回答を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const feedback = await getAIFeedback(userAnswer, selectedQuestion);
      setAiFeedback(feedback);

      await practiceAPI.create(
        selectedQuestion.id,
        userAnswer,
        isRecording ? 'voice' : 'text',
        feedback
      );
    } catch (err) {
      setError('AIフィードバックの取得に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== CONVERSATION MODE FUNCTIONS =====

  const handleEnableConversationMode = async () => {
    if (!userAnswer.trim() || !aiFeedback) {
      setError('まず最初の回答を提出してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const conversation = await conversationAPI.create(selectedQuestion.id, userAnswer);
      setActiveConversation(conversation);
      setConversationMode(true);
      
      // Refresh credits after AI operation
      await refreshUserCredits();
    } catch (err) {
      setError('対話モードの開始に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestFollowUp = async () => {
    if (!activeConversation) {
      setError('対話モードが有効になっていません');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const followUp = await conversationAPI.generateFollowUp(activeConversation.id);
      setPendingFollowUp(followUp);
      setFollowUpAnswer('');
      
      // Refresh credits after AI operation
      await refreshUserCredits();
    } catch (err) {
      setError('追問の生成に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFollowUpAnswer = async () => {
    if (!followUpAnswer.trim()) {
      setError('回答を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const evaluation = await conversationAPI.answerFollowUp(activeConversation.id, followUpAnswer);
      
      // Update conversation turns
      const updatedConversation = await conversationAPI.getActive(selectedQuestion.id);
      setActiveConversation(updatedConversation);
      
      // Clear pending follow-up
      setPendingFollowUp({ ...pendingFollowUp, evaluation });
      setFollowUpAnswer('');
      
      // Refresh credits after AI operation
      await refreshUserCredits();
      
      // Show whether more follow-ups are recommended
      if (!evaluation.needsMoreFollowUp) {
        alert('素晴らしい回答です！この質問の練習は完了です。');
      }
    } catch (err) {
      setError('回答の評価に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteConversation = async () => {
    if (!activeConversation) return;

    try {
      console.log('🔄 Completing conversation:', activeConversation.id);
      await conversationAPI.complete(activeConversation.id);
      
      // Check if already favorited
      const existingFavorite = favorites.find(f => f.question_id === selectedQuestion.id);
      
      console.log('💾 Saving to favorites with conversation_id:', activeConversation.id);
      console.log('📊 Existing favorite:', existingFavorite ? 'YES' : 'NO');
      
      if (existingFavorite) {
        // Update existing favorite with conversation history
        console.log('⬆️ Updating existing favorite...');
        await favoritesAPI.update(
          existingFavorite.id,
          userAnswer || null,
          aiFeedback || null,
          aiFeedback?.correctedVersion || null,
          activeConversation.id
        );
      } else {
        // Add new favorite with conversation history
        console.log('➕ Adding new favorite...');
        await favoritesAPI.add(
          selectedQuestion.id,
          null,
          '',
          userAnswer || null,
          aiFeedback || null,
          aiFeedback?.correctedVersion || null,
          activeConversation.id
        );
      }
      
      const updatedFavorites = await favoritesAPI.getAll(favoritesPage, favoritesPerPage);
      console.log('✅ Updated favorites:', updatedFavorites.length);
      setFavorites(updatedFavorites.favorites || updatedFavorites);
      setFavoritesTotal(updatedFavorites.total || (updatedFavorites.favorites || updatedFavorites).length);
      
      alert('対話を完了し、お気に入りに保存しました！');
      
      // Reset conversation state
      setConversationMode(false);
      setActiveConversation(null);
      setPendingFollowUp(null);
      setFollowUpAnswer('');
    } catch (err) {
      setError('対話の完了に失敗しました: ' + err.message);
    }
  };

  // ===== END CONVERSATION MODE FUNCTIONS =====

  // ===== VOCABULARY FUNCTIONS =====
  
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && text.length > 0 && text.length < 100) {
      setSelectedText(text);
      
      // Get selection position for floating icon
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setFloatingSearchPos({
        x: rect.right + 10,
        y: rect.top - 5
      });
    } else {
      setSelectedText('');
      setFloatingSearchPos(null);
    }
  };

  const handleAnalyzeVocabulary = async () => {
    if (!selectedText) return;
    
    setLoading(true);
    setError('');
    
    try {
      const analysis = await vocabularyAPI.analyze(selectedText);
      setVocabularyAnalysis(analysis);
      setShowVocabularyPopup(true);
      
      // Hide the floating search button after analysis
      setFloatingSearchPos(null);
      
      // Refresh credits after AI operation
      await refreshUserCredits();
    } catch (err) {
      setError('词汇分析失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVocabulary = async () => {
    if (!vocabularyAnalysis || !selectedText) {
      alert('保存失败：没有选择单词');
      return;
    }
    
    // Save the data before clearing state
    const wordToSave = selectedText.trim();
    const dataToSave = {
      word: wordToSave,
      translation: vocabularyAnalysis.translation,
      explanation: vocabularyAnalysis.explanation,
      example_sentences: vocabularyAnalysis.exampleSentences,
      tags: vocabularyAnalysis.tags
    };
    
    // Clear UI state immediately to prevent showing "分析中..." button
    setShowVocabularyPopup(false);
    setSelectedText('');
    setVocabularyAnalysis(null);
    setFloatingSearchPos(null);
    
    setLoading(true);
    try {
      console.log('📤 Saving vocabulary:', wordToSave);
      const savedNote = await vocabularyAPI.save(dataToSave);
      
      console.log('✅ Vocabulary saved:', savedNote);
      
      // Reload vocabulary notes
      const updatedNotes = await vocabularyAPI.getAll(vocabularyPage, vocabularyPerPage);
      setVocabularyNotes(updatedNotes.notes || updatedNotes);
      setVocabularyTotal(updatedNotes.total || (updatedNotes.notes || updatedNotes).length);
      
      // Show toast notification
      if (savedNote.synced_to_notion) {
        showToast('✅ 保存成功！已同步到Notion', 'success');
      } else if (notionEnabled) {
        showToast('✅ 已保存到本地数据库', 'warning');
      } else {
        showToast('✅ 保存成功！', 'success');
      }
    } catch (err) {
      console.error('❌ Save vocabulary error:', err);
      setError('保存失败: ' + err.message);
      showToast('❌ 保存失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVocabulary = async (id) => {
    if (!confirm('确定要删除这个词汇吗？')) return;
    
    try {
      await vocabularyAPI.delete(id);
      const updatedNotes = await vocabularyAPI.getAll(vocabularyPage, vocabularyPerPage);
      setVocabularyNotes(updatedNotes.notes || updatedNotes);
      setVocabularyTotal(updatedNotes.total || (updatedNotes.notes || updatedNotes).length);
    } catch (err) {
      setError('删除失败: ' + err.message);
    }
  };

  const startReviewMode = () => {
    if (vocabularyNotes.length === 0) {
      alert('还没有单词可以复习！');
      return;
    }
    setReviewMode(true);
    setCurrentReviewIndex(0);
    setShowAnswer(false);
  };

  const exitReviewMode = () => {
    setReviewMode(false);
    setCurrentReviewIndex(0);
    setShowAnswer(false);
  };

  const nextReviewCard = () => {
    setShowAnswer(false);
    if (currentReviewIndex < vocabularyNotes.length - 1) {
      setCurrentReviewIndex(currentReviewIndex + 1);
    } else {
      setCurrentReviewIndex(0);
    }
  };

  const prevReviewCard = () => {
    setShowAnswer(false);
    if (currentReviewIndex > 0) {
      setCurrentReviewIndex(currentReviewIndex - 1);
    } else {
      setCurrentReviewIndex(vocabularyNotes.length - 1);
    }
  };

  // ===== END VOCABULARY FUNCTIONS =====

  const handleToggleFavorite = async (questionId) => {
    console.log('🔍 handleToggleFavorite called with questionId:', questionId);
    console.log('🔍 selectedQuestion:', selectedQuestion);
    
    try {
      const isFav = await favoritesAPI.isFavorite(questionId);
      
      if (isFav) {
        console.log('➖ Removing from favorites:', questionId);
        await favoritesAPI.remove(questionId);
      } else {
        console.log('➕ Adding to favorites:', questionId);
        console.log('   userAnswer:', userAnswer?.substring(0, 50));
        console.log('   aiFeedback:', aiFeedback);
        // When adding to favorites, save current answer and AI feedback if available
        await favoritesAPI.add(
          questionId,
          null,
          '',
          userAnswer || null,
          aiFeedback || null,
          aiFeedback?.correctedVersion || null
        );
      }
      
      const updatedFavorites = await favoritesAPI.getAll(favoritesPage, favoritesPerPage);
      setFavorites(updatedFavorites.favorites || updatedFavorites);
      setFavoritesTotal(updatedFavorites.total || (updatedFavorites.favorites || updatedFavorites).length);
    } catch (err) {
      console.error('❌ Favorite toggle error:', err);
      setError('お気に入りの更新に失敗しました: ' + err.message);
    }
  };

  const handleSaveQuestion = async () => {
    setLoading(true);
    setError('');

    try {
      if (editingQuestion) {
        await questionsAPI.update(editingQuestion.id, questionForm);
      } else {
        await questionsAPI.create({
          ...questionForm,
          is_ai_generated: false
        });
      }

      const updatedQuestions = await questionsAPI.getAll(categoryFilter === 'all' ? null : categoryFilter, currentPage, questionsPerPage, searchKeyword);
      setQuestions(updatedQuestions.questions || updatedQuestions);
      setQuestionsTotal(updatedQuestions.total || (updatedQuestions.questions || updatedQuestions).length);
      setCurrentView('questions');
      setEditingQuestion(null);
      setQuestionForm({
        category: 'HR',
        question_ja: '',
        question_zh: '',
        model_answer_ja: '',
        tips_ja: [],
        summary: ''
      });
    } catch (err) {
      setError('質問の保存に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('本当にこの質問を削除しますか？')) return;

    try {
      await questionsAPI.delete(questionId);
      const updatedQuestions = await questionsAPI.getAll(categoryFilter === 'all' ? null : categoryFilter, currentPage, questionsPerPage, searchKeyword);
      setQuestions(updatedQuestions.questions || updatedQuestions);
      setQuestionsTotal(updatedQuestions.total || (updatedQuestions.questions || updatedQuestions).length);
    } catch (err) {
      setError('質問の削除に失敗しました: ' + err.message);
    }
  };

  const handleGenerateQuestions = async (category, count = 3) => {
    setLoading(true);
    setError('');

    try {
      const resumeInfo = resumes.length > 0 ? {
        skills: resumes[0].skills,
        experience: resumes[0].experience,
        education: resumes[0].education
      } : null;
      
      const newQuestions = await questionsAPI.generate(category, count, resumeInfo);

      const updatedQuestions = await questionsAPI.getAll(categoryFilter === 'all' ? null : categoryFilter, currentPage, questionsPerPage, searchKeyword);
      setQuestions(updatedQuestions.questions || updatedQuestions);
      setQuestionsTotal(updatedQuestions.total || (updatedQuestions.questions || updatedQuestions).length);
      setShowGenerateModal(false);
      
      // Refresh credits after AI operation
      await refreshUserCredits();
      
      alert(`${count}個の新しい${category}質問を生成しました！`);
    } catch (err) {
      setError('質問の生成に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openGenerateModal = () => {
    // すべてタブの場合は選択モーダルを表示、それ以外は直接生成
    if (categoryFilter === 'all') {
      setGenerateCategory('HR');
      setGenerateCount(3);
      setShowGenerateModal(true);
    } else {
      handleGenerateQuestions(categoryFilter, 3);
    }
  };

  const handleImportQuestions = async () => {
    if (!importFile) return;

    setLoading(true);
    setError('');

    try {
      const result = await questionsAPI.importFromDocument(importFile);
      const updatedQuestions = await questionsAPI.getAll(categoryFilter === 'all' ? null : categoryFilter, currentPage, questionsPerPage, searchKeyword);
      setQuestions(updatedQuestions.questions || updatedQuestions);
      setQuestionsTotal(updatedQuestions.total || (updatedQuestions.questions || updatedQuestions).length);
      setShowImportModal(false);
      setImportFile(null);
      alert(result.message);
    } catch (err) {
      setError('文書のインポートに失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeQuestion = async () => {
    if (!analyzingQuestion) return;

    setLoading(true);
    setError('');

    try {
      const updatedQuestion = await questionsAPI.analyzeQuestion(
        analyzingQuestion.id,
        analysisPrompt,
        generateAnswer
      );
      
      const updatedQuestions = await questionsAPI.getAll(categoryFilter === 'all' ? null : categoryFilter, currentPage, questionsPerPage, searchKeyword);
      setQuestions(updatedQuestions.questions || updatedQuestions);
      setQuestionsTotal(updatedQuestions.total || (updatedQuestions.questions || updatedQuestions).length);
      setShowAnalysisModal(false);
      setAnalyzingQuestion(null);
      setAnalysisPrompt('');
      
      // Refresh credits after AI operation
      await refreshUserCredits();
      
      alert('質問の解析が完了しました！');
    } catch (err) {
      setError('質問の解析に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      // Upload file directly to server for parsing
      setError('📝 履歴書を解析中...');
      await resumeAPI.uploadFile(file);
      
      setError('✅ 解析完了、データを更新中...');
      const updatedResumes = await resumeAPI.getAll();
      setResumes(updatedResumes);
      
      setError('');
      alert('履歴書を正常にアップロードしました！');
      
      // Check if user has taken vocab test before
      console.log('🔍 Checking vocab test status...');
      const testStatusResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/vocabulary/check-test-status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const { hasTakenTest } = await testStatusResponse.json();
      console.log('📊 Has taken test:', hasTakenTest);
      
      // If user hasn't taken test and resume has skills, generate professional vocabulary test
      if (!hasTakenTest && updatedResumes.length > 0) {
        const resume = updatedResumes[0];
        console.log('📄 Resume data:', {
          hasSkills: !!resume.skills,
          skillsLength: resume.skills?.length,
          skills: resume.skills
        });
        
        if (resume.skills && resume.skills.length > 0) {
          console.log('✅ Triggering vocabulary test...');
          await generateVocabularyTest(resume);
        } else {
          console.log('❌ No skills found, skipping vocab test');
        }
      } else {
        console.log('❌ Skipping vocab test:', { hasTakenTest, hasResumes: updatedResumes.length > 0 });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('ファイルの処理に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate vocabulary test based on resume skills
  const generateVocabularyTest = async (resume) => {
    try {
      setIsProcessingVocabTest(true);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/vocabulary/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          skills: resume.skills,
          experience: resume.experience
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate vocabulary test');
      
      const data = await response.json();
      setVocabTestWords(data.words || []);
      setShowVocabTest(true);
    } catch (err) {
      console.error('Vocabulary test generation failed:', err);
    } finally {
      setIsProcessingVocabTest(false);
    }
  };
  
  // Handle vocabulary test completion
  const handleVocabTestComplete = async () => {
    const unknownWords = Object.entries(vocabTestResults)
      .filter(([_, known]) => !known)
      .map(([word, _]) => vocabTestWords.find(w => w.word === word));
    
    if (unknownWords.length > 0) {
      try {
        for (const wordData of unknownWords) {
          await vocabularyAPI.save(wordData);
        }
        const updatedVocab = await vocabularyAPI.getAll(vocabularyPage, vocabularyPerPage);
        setVocabularyNotes(updatedVocab.notes || updatedVocab);
        setVocabularyTotal(updatedVocab.total || (updatedVocab.notes || updatedVocab).length);
        alert(`${unknownWords.length}個の専門用語を単語帳に追加しました！`);
      } catch (err) {
        console.error('Failed to save vocabulary:', err);
      }
    }
    
    setShowVocabTest(false);
    setVocabTestWords([]);
    setVocabTestResults({});
  };
  
  // Edit vocabulary
  const handleEditVocabulary = (note) => {
    setEditingVocabulary(note);
    setVocabularyForm({
      word: note.word,
      translation: note.translation,
      explanation: note.explanation || '',
      example_sentences: note.example_sentences || []
    });
    setShowVocabEditModal(true);
  };
  
  // Update edited vocabulary
  const handleUpdateVocabulary = async () => {
    try {
      await vocabularyAPI.update(editingVocabulary.id, vocabularyForm);
      const updatedVocab = await vocabularyAPI.getAll(vocabularyPage, vocabularyPerPage);
      setVocabularyNotes(updatedVocab.notes || updatedVocab);
      setShowVocabEditModal(false);
      setEditingVocabulary(null);
    } catch (err) {
      setError('単語の更新に失敗しました: ' + err.message);
    }
  };

  const filteredQuestions = questions;

  const favoriteQuestions = questions.filter(q => 
    favorites.some(f => f.question_id === q.id)
  );

  // Handle search
  const handleSearch = async () => {
    setCurrentPage(1);
    const data = await questionsAPI.getAll(
      categoryFilter === 'all' ? null : categoryFilter,
      1,
      questionsPerPage,
      searchKeyword
    );
    setQuestions(data.questions || data);
    setQuestionsTotal(data.total || (data.questions || data).length);
  };

  // Pagination component
  const Pagination = ({ currentPage, totalItems, onPageChange, itemsPerPage = 10, onItemsPerPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) return null;
    
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          «
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ‹
        </button>
        
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              1
            </button>
            {startPage > 2 && <span className="px-2">...</span>}
          </>
        )}
        
        {pages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 rounded-lg border ${
              page === currentPage
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              {totalPages}
            </button>
          </>
        )}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          »
        </button>
        
        <span className="ml-4 text-sm text-gray-600">
          {currentPage} / {totalPages} ページ ({totalItems}件)
        </span>
        
        {onItemsPerPageChange && (
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
            className="ml-4 px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={10}>10件/ページ</option>
            <option value={20}>20件/ページ</option>
            <option value={50}>50件/ページ</option>
            <option value={100}>100件/ページ</option>
          </select>
        )}
      </div>
    );
  };

  // Login View (shortened for brevity - keeping same structure)
  if (!currentUser && currentView === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">日本面接練習器</h1>
            <p className="text-gray-600">Japanese Interview Coach</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="email@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              ログイン
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setCurrentView('register')}
              className="text-blue-600 hover:underline"
            >
              アカウントを作成
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Register View (similar structure)
  if (!currentUser && currentView === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">新規登録</h1>
            <p className="text-gray-600">Create Account</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ユーザー名（任意）</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="山田太郎"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com"
                  required
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading || countdown > 0 || !email}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                >
                  {countdown > 0 ? `${countdown}s` : 'コード送信'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">認証コード</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="6桁の認証コード"
                required
                maxLength={6}
                pattern="\d{6}"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
              登録
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setCurrentView('login')}
              className="text-blue-600 hover:underline"
            >
              ログインに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading spinner during initialization
  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // Main App (Logged in)
  
  // Admin Panel
  if (currentView === 'admin' && currentUser?.role === 'admin') {
    return <AdminPanel user={currentUser} onLogout={handleLogout} />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
              <h1 className="text-base md:text-2xl font-bold text-gray-800 truncate">日本面接練習器</h1>
              <span className="text-xs md:text-sm text-gray-500 hidden sm:inline">ようこそ、{currentUser.username}さん</span>
            </div>
            <div className="flex items-center gap-1 md:gap-3">
              {/* AI Credits Display */}
              <button
                onClick={handleOpenCredits}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-lg hover:from-yellow-500 hover:to-yellow-600 transition shadow-sm text-sm md:text-base"
                title="AIポイント残高"
              >
                <Coins className="w-4 h-4 md:w-5 md:h-5" />
                <span className="font-semibold">{aiCredits}</span>
                <span className="text-xs hidden md:inline">ポイント</span>
              </button>
              
              {/* Settings Button */}
              <button
                onClick={handleOpenSettings}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                title="設定"
              >
                <Settings className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
                ログアウト
              </button>
              <button
                onClick={handleLogout}
                className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                title="ログアウト"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b shadow-sm sticky top-[57px] md:top-[65px] z-10">
        <div className="max-w-7xl mx-auto px-2 md:px-4 py-2 md:py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setCurrentView('home')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="hidden sm:inline">ホーム</span>
          </button>
          <button
            onClick={() => setCurrentView('random')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'random' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Shuffle className="w-5 h-5" />
            <span className="hidden sm:inline">ランダム練習</span>
            <span className="sm:hidden">練習</span>
          </button>
          <button
            onClick={() => setCurrentView('questions')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'questions' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="hidden sm:inline">質問管理</span>
            <span className="sm:hidden">質問</span>
          </button>
          <button
            onClick={() => setCurrentView('favorites')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'favorites' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Star className="w-5 h-5" />
            <span className="hidden sm:inline">お気に入り ({favorites.length})</span>
            <span className="sm:hidden">★ {favorites.length}</span>
          </button>
          <button
            onClick={() => setCurrentView('vocabulary')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'vocabulary' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Book className="w-5 h-5" />
            <span className="hidden sm:inline">単語帳 ({vocabularyNotes.length})</span>
            <span className="sm:hidden">単語 {vocabularyNotes.length}</span>
          </button>
          <button
            onClick={() => setCurrentView('resumes')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'resumes' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="hidden sm:inline">履歴書 ({resumes.length})</span>
            <span className="sm:hidden">CV {resumes.length}</span>
          </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}><X className="w-5 h-5" /></button>
          </div>
        )}

        {/* Random Practice View */}
        {currentView === 'random' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6" onMouseUp={handleTextSelection}>
              <h2 className="text-2xl font-bold mb-4">ランダム面接練習</h2>
              <p className="text-gray-600 mb-6">
                カテゴリを選択すると、ランダムに質問が選ばれます。実際の面接のような緊張感を体験できます！
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => startRandomPractice('all')}
                  disabled={loading}
                  className="border-2 border-purple-200 rounded-lg p-6 hover:border-purple-400 transition disabled:opacity-50"
                >
                  <div className="text-center">
                    <Shuffle className="w-12 h-12 mx-auto mb-3 text-purple-600" />
                    <h3 className="text-xl font-semibold mb-2">すべての質問</h3>
                    <p className="text-gray-600 text-sm mb-4">HR と Tech から ランダム</p>
                    <div className="text-purple-600 font-medium">{questions.length} 問</div>
                  </div>
                </button>

                <button
                  onClick={() => startRandomPractice('HR')}
                  disabled={loading}
                  className="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition disabled:opacity-50"
                >
                  <div className="text-center">
                    <User className="w-12 h-12 mx-auto mb-3 text-blue-600" />
                    <h3 className="text-xl font-semibold mb-2">HR 質問</h3>
                    <p className="text-gray-600 text-sm mb-4">志望動機、自己PR など</p>
                    <div className="text-blue-600 font-medium">
                      {questions.filter(q => q.category === 'HR').length} 問
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => startRandomPractice('Tech')}
                  disabled={loading}
                  className="border-2 border-green-200 rounded-lg p-6 hover:border-green-400 transition disabled:opacity-50"
                >
                  <div className="text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <h3 className="text-xl font-semibold mb-2">Tech 質問</h3>
                    <p className="text-gray-600 text-sm mb-4">技術スタック、経験 など</p>
                    <div className="text-green-600 font-medium">
                      {questions.filter(q => q.category === 'Tech').length} 問
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Home View */}
        {currentView === 'home' && (
          <div className="space-y-6">
            {/* New User Onboarding - Encourage Resume Upload */}
            {resumes.length === 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">🎯 履歴書をアップロードして、パーソナライズされた面接練習を始めましょう！</h3>
                    <p className="text-gray-700 mb-4">
                      履歴書をアップロードすると、あなたの経験やスキルに基づいた面接質問が自動生成されます。
                      さらに、専門用語チェックで単語帳を充実させることができます。
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setCurrentView('resumes')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold"
                      >
                        <Upload className="w-5 h-5" />
                        今すぐアップロード
                      </button>
                      <button
                        onClick={() => setCurrentView('questions')}
                        className="px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-semibold"
                      >
                        後で、質問から始める
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-white rounded-lg shadow-sm p-6" onMouseUp={handleTextSelection}>
              <h2 className="text-2xl font-bold mb-4">面接練習を始めましょう</h2>
              <p className="text-gray-600 mb-6">
                カテゴリを選択して、日本語面接の練習を開始してください。
                AI が あなたの回答を分析し、フィードバックを提供します。
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition cursor-pointer"
                     onClick={() => { setCategoryFilter('HR'); setCurrentView('questions'); }}>
                  <h3 className="text-xl font-semibold mb-2">HR / 一般質問</h3>
                  <p className="text-gray-600 mb-4">志望動機、自己PR、キャリアプランなど</p>
                  <div className="text-blue-600 font-medium">
                    {questions.filter(q => q.category === 'HR').length} 問
                  </div>
                </div>

                <div className="border-2 border-green-200 rounded-lg p-6 hover:border-green-400 transition cursor-pointer"
                     onClick={() => { setCategoryFilter('Tech'); setCurrentView('questions'); }}>
                  <h3 className="text-xl font-semibold mb-2">Tech / 技術質問</h3>
                  <p className="text-gray-600 mb-4">プロジェクト経験、技術スタック、問題解決など</p>
                  <div className="text-green-600 font-medium">
                    {questions.filter(q => q.category === 'Tech').length} 問
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">💡 PREP法を意識しましょう</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li><strong>Point:</strong> 結論を先に述べる</li>
                  <li><strong>Reason:</strong> その理由を説明する</li>
                  <li><strong>Example:</strong> 具体例を示す</li>
                  <li><strong>Point:</strong> 再度結論を述べる</li>
                </ul>
              </div>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-3xl font-bold text-blue-600">{questions.length}</div>
                <div className="text-gray-600">利用可能な質問</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-3xl font-bold text-green-600">{favorites.length}</div>
                <div className="text-gray-600">お気に入り</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-3xl font-bold text-purple-600">{resumes.length}</div>
                <div className="text-gray-600">アップロード済み履歴書</div>
              </div>
            </div>
          </div>
        )}

        {/* Questions View - continuing with existing structure but using new API */}
        {currentView === 'questions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <h2 className="text-xl md:text-2xl font-bold">質問管理</h2>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setEditingQuestion(null);
                      setQuestionForm({
                        category: 'HR',
                        question_ja: '',
                        question_zh: '',
                        model_answer_ja: '',
                        tips_ja: [],
                        summary: ''
                      });
                      setCurrentView('editQuestion');
                    }}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm md:text-base whitespace-nowrap"
                  >
                    <PlusCircle className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden sm:inline">手動追加</span>
                    <span className="sm:hidden">追加</span>
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm md:text-base whitespace-nowrap"
                  >
                    <FileUp className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden sm:inline">文書導入</span>
                    <span className="sm:hidden">導入</span>
                  </button>
                  <button
                    onClick={openGenerateModal}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm md:text-base whitespace-nowrap"
                  >
                    {loading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />}
                    <span className="hidden sm:inline">AI生成</span>
                    <span className="sm:hidden">AI</span>
                  </button>
                </div>
              </div>

              {/* Search Box */}
              <div className="mb-4">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="キーワードで検索... (質問、回答、要点)"
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                  <button
                    onClick={handleSearch}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    検索
                  </button>
                  {searchKeyword && (
                    <button
                      onClick={async () => {
                        setSearchKeyword('');
                        setCurrentPage(1);
                        const data = await questionsAPI.getAll(
                          categoryFilter === 'all' ? null : categoryFilter,
                          1,
                          questionsPerPage,
                          ''
                        );
                        setQuestions(data.questions || data);
                        setQuestionsTotal(data.total || (data.questions || data).length);
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      クリア
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={async () => {
                    setCategoryFilter('all');
                    setCurrentPage(1);
                    const data = await questionsAPI.getAll(null, 1, questionsPerPage, searchKeyword);
                    setQuestions(data.questions || data);
                    setQuestionsTotal(data.total || (data.questions || data).length);
                  }}
                  className={`px-4 py-2 rounded-lg ${categoryFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}
                >
                  すべて ({questionsTotal})
                </button>
                <button
                  onClick={async () => {
                    setCategoryFilter('HR');
                    setCurrentPage(1);
                    const data = await questionsAPI.getAll('HR', 1, questionsPerPage, searchKeyword);
                    setQuestions(data.questions || data);
                    setQuestionsTotal(data.total || (data.questions || data).length);
                  }}
                  className={`px-4 py-2 rounded-lg ${categoryFilter === 'HR' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                >
                  HR
                </button>
                <button
                  onClick={async () => {
                    setCategoryFilter('Tech');
                    setCurrentPage(1);
                    const data = await questionsAPI.getAll('Tech', 1, questionsPerPage, searchKeyword);
                    setQuestions(data.questions || data);
                    setQuestionsTotal(data.total || (data.questions || data).length);
                  }}
                  className={`px-4 py-2 rounded-lg ${categoryFilter === 'Tech' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
                >
                  Tech
                </button>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {filteredQuestions.map((question) => {
                  const isExpanded = expandedQuestions.has(question.id);
                  // 获取分类信息，处理空值
                  const categoryInfo = {
                    'HR': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'HR' },
                    'Tech': { bg: 'bg-green-100', text: 'text-green-700', label: 'Tech' },
                    'technical': { bg: 'bg-green-100', text: 'text-green-700', label: 'Tech' },
                    'hr': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'HR' },
                  };
                  const category = question.category || 'HR';
                  const catInfo = categoryInfo[category] || { bg: 'bg-gray-100', text: 'text-gray-700', label: category || '未分類' };
                  
                  return (
                  <div key={question.id} className="border rounded-lg hover:border-blue-300 transition" onMouseUp={handleTextSelection}>
                    <div className="p-3 md:p-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-2">
                        <div className="flex-1 cursor-pointer" onClick={() => toggleQuestionExpand(question.id)}>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-1 text-xs rounded ${catInfo.bg} ${catInfo.text}`}>
                              {catInfo.label}
                            </span>
                            {question.is_ai_generated === 1 && (
                              <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">AI生成</span>
                            )}
                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                          <h3 className="font-semibold text-base md:text-lg mb-1">{question.question_ja}</h3>
                          {question.question_zh && (
                            <p className="text-gray-600 text-sm">{question.question_zh}</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap md:flex-nowrap">
                          <button
                            onClick={() => handleToggleFavorite(question.id)}
                            className={`p-2 rounded-lg ${
                              favorites.some(f => f.question_id === question.id)
                                ? 'text-yellow-500 bg-yellow-50'
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            <Star className="w-5 h-5" fill={favorites.some(f => f.question_id === question.id) ? 'currentColor' : 'none'} />
                          </button>
                          {question.user_id && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingQuestion(question);
                                  setQuestionForm({
                                    category: question.category,
                                    question_ja: question.question_ja,
                                    question_zh: question.question_zh || '',
                                    model_answer_ja: question.model_answer_ja || '',
                                    tips_ja: question.tips_ja || [],
                                    summary: question.summary || ''
                                  });
                                  setCurrentView('editQuestion');
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setAnalyzingQuestion(question);
                                  setAnalysisPrompt('');
                                  setGenerateAnswer(!question.model_answer_ja);
                                  setShowAnalysisModal(true);
                                }}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                                title="AI解析"
                              >
                                <Sparkles className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(question.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => startPractice(question)}
                            className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 md:gap-2 text-sm md:text-base whitespace-nowrap"
                          >
                            <Play className="w-4 h-4" />
                            <span className="hidden md:inline">練習</span>
                            <span className="md:hidden">練習</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          {question.model_answer_ja && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">📝 模範回答:</h4>
                              <div className="bg-gray-50 p-3 rounded-lg text-sm whitespace-pre-wrap text-gray-800">
                                {question.model_answer_ja}
                              </div>
                            </div>
                          )}
                          {question.tips_ja && question.tips_ja.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">💡 回答のポイント:</h4>
                              <ul className="space-y-1">
                                {question.tips_ja.map((tip, idx) => (
                                  <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="text-blue-500 mt-0.5">•</span>
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {question.summary && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">📌 Summary:</h4>
                              <p className="text-sm text-gray-600">{question.summary}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}

                {filteredQuestions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    質問がありません。AI生成または手動で追加してください。
                  </div>
                )}
              </div>
              
              {/* Pagination */}
              <Pagination 
                currentPage={currentPage}
                totalItems={questionsTotal}
                onPageChange={async (page) => {
                  setCurrentPage(page);
                  const data = await questionsAPI.getAll(categoryFilter === 'all' ? null : categoryFilter, page, questionsPerPage, searchKeyword);
                  setQuestions(data.questions || data);
                  setQuestionsTotal(data.total || (data.questions || data).length);
                }}
                itemsPerPage={questionsPerPage}
                onItemsPerPageChange={async (newSize) => {
                  setQuestionsPerPage(newSize);
                  setCurrentPage(1);
                  const data = await questionsAPI.getAll(categoryFilter === 'all' ? null : categoryFilter, 1, newSize, searchKeyword);
                  setQuestions(data.questions || data);
                  setQuestionsTotal(data.total || (data.questions || data).length);
                }}
              />
            </div>
          </div>
        )}

        {/* Edit Question View - similar to before */}
        {currentView === 'editQuestion' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">
              {editingQuestion ? '質問を編集' : '新しい質問を追加'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-2">カテゴリ</label>
                <select
                  value={questionForm.category}
                  onChange={(e) => setQuestionForm({...questionForm, category: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="HR">HR / 一般</option>
                  <option value="Tech">Tech / 技術</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-2">質問（日本語）</label>
                <textarea
                  value={questionForm.question_ja}
                  onChange={(e) => setQuestionForm({...questionForm, question_ja: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-2">質問（中国語）</label>
                <textarea
                  value={questionForm.question_zh}
                  onChange={(e) => setQuestionForm({...questionForm, question_zh: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={3}
                />
              </div>

              <div>
                <label className="block font-medium mb-2">模範回答（PREP法）</label>
                <textarea
                  value={questionForm.model_answer_ja}
                  onChange={(e) => setQuestionForm({...questionForm, model_answer_ja: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={8}
                  placeholder="【Point】...&#10;【Reason】...&#10;【Example】...&#10;【Point】..."
                />
              </div>

              <div>
                <label className="block font-medium mb-2">回答のコツ（カンマ区切り）</label>
                <input
                  type="text"
                  value={Array.isArray(questionForm.tips_ja) ? questionForm.tips_ja.join(', ') : ''}
                  onChange={(e) => setQuestionForm({
                    ...questionForm, 
                    tips_ja: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="コツ1, コツ2, コツ3"
                />
              </div>

              <div>
                <label className="block font-medium mb-2">要約（英語、AI重複チェック用）</label>
                <input
                  type="text"
                  value={questionForm.summary}
                  onChange={(e) => setQuestionForm({...questionForm, summary: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Brief summary in English"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSaveQuestion}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  保存
                </button>
                <button
                  onClick={() => setCurrentView('questions')}
                  className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Practice View - continuing with existing structure */}
        {currentView === 'practice' && selectedQuestion && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    selectedQuestion.category === 'HR' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {selectedQuestion.category || 'HR'}
                  </span>
                  {selectedQuestion.is_ai_generated === 1 && (
                    <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">AI生成</span>
                  )}
                </div>
                <button
                  onClick={() => handleToggleFavorite(selectedQuestion.id)}
                  className={`p-2 rounded-lg ${
                    favorites.some(f => f.question_id === selectedQuestion.id)
                      ? 'text-yellow-500 bg-yellow-50'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <Star className="w-6 h-6" fill={favorites.some(f => f.question_id === selectedQuestion.id) ? 'currentColor' : 'none'} />
                </button>
              </div>

              <h2 className="text-2xl font-bold mb-2" onMouseUp={handleTextSelection}>
                {selectedQuestion.question_ja}
              </h2>
              {selectedQuestion.question_zh && (
                <p className="text-gray-600 mb-4" onMouseUp={handleTextSelection}>
                  {selectedQuestion.question_zh}
                </p>
              )}

              {/* Tips */}
              {selectedQuestion.tips_ja && selectedQuestion.tips_ja.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6" onMouseUp={handleTextSelection}>
                  <h3 className="font-semibold mb-2">💡 回答のコツ</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {selectedQuestion.tips_ja.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Answer Input */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-medium">あなたの回答</label>
                  <div className="flex gap-2">
                    {!isRecording ? (
                      <button
                        onClick={handleStartRecording}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        <Mic className="w-5 h-5" />
                        音声で回答
                      </button>
                    ) : (
                      <button
                        onClick={handleStopRecording}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 animate-pulse"
                      >
                        <Mic className="w-5 h-5" />
                        録音中...
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={8}
                  placeholder="ここに回答を入力してください。音声で回答することもできます。"
                />
              </div>

              <button
                onClick={handleSubmitAnswer}
                disabled={loading || !userAnswer.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    AIが分析中...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-5 h-5" />
                    AIフィードバックを取得
                  </>
                )}
              </button>

              {/* Skip to Next Question Button */}
              <button
                onClick={handleSkipToNext}
                disabled={loading}
                className="w-full mt-3 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ChevronRight className="w-5 h-5" />
                次へスキップ
              </button>
            </div>

            {/* AI Feedback */}
            {aiFeedback && (
              <div className="bg-white rounded-lg shadow-sm p-6" onMouseUp={handleTextSelection}>
                <h3 className="text-xl font-bold mb-4">AIフィードバック</h3>
                
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">スコア</span>
                    <span className="text-3xl font-bold text-blue-600">{aiFeedback.score}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        aiFeedback.score >= 80 ? 'bg-green-500' :
                        aiFeedback.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{width: `${aiFeedback.score}%`}}
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold mb-2">総評</h4>
                  <p className="text-gray-700">{aiFeedback.feedback}</p>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold mb-2">改善アドバイス</h4>
                  <ul className="space-y-2">
                    {aiFeedback.advice?.map((item, idx) => (
                      <li key={idx} className="flex gap-2">
                        <ChevronRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">修正版（商務日本語）</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 whitespace-pre-wrap markdown-content">
                    <ReactMarkdown>{aiFeedback.correctedVersion}</ReactMarkdown>
                  </div>
                </div>

                {/* Conversation Mode Toggle */}
                {!conversationMode && (
                  <div className="mt-6 pt-6 border-t">
                    <button
                      onClick={handleEnableConversationMode}
                      className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-5 h-5" />
                      対話モードを開始（AIが追問します）
                    </button>
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      より深掘りした質問で面接の練習を続けます
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Conversation Mode */}
            {conversationMode && activeConversation && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                  対話モード
                </h3>

                {/* Conversation History */}
                <div className="space-y-4 mb-6">
                  {activeConversation.conversation_turns?.map((turn, idx) => (
                    <div key={idx} className={`p-4 rounded-lg ${turn.type === 'initial' ? 'bg-blue-50' : 'bg-purple-50'}`} onMouseUp={handleTextSelection}>
                      {turn.type === 'followup' && (
                        <>
                          <div className="mb-3">
                            <h4 className="font-semibold text-purple-700 mb-1">追問 #{idx}</h4>
                            <p className="text-gray-800">{turn.followUpQuestion}</p>
                            {turn.reasoning && (
                              <p className="text-xs text-gray-500 mt-1">💡 {turn.reasoning}</p>
                            )}
                          </div>
                          {turn.userAnswer && (
                            <>
                              <div className="mb-2">
                                <h5 className="font-medium text-sm text-gray-700">あなたの回答:</h5>
                                <p className="text-gray-600 bg-white p-2 rounded">{turn.userAnswer}</p>
                              </div>
                              {turn.aiFeedback && (
                                <div className="bg-white p-3 rounded">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-semibold text-sm">スコア:</span>
                                    <span className="text-lg font-bold text-purple-600">{turn.aiFeedback.score}/100</span>
                                  </div>
                                  <p className="text-sm text-gray-700">{turn.aiFeedback.feedback}</p>
                                  {turn.aiFeedback.improvements && turn.aiFeedback.improvements.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs font-semibold text-gray-600">改善点:</p>
                                      <ul className="text-xs space-y-1 mt-1">
                                        {turn.aiFeedback.improvements.map((imp, i) => (
                                          <li key={i} className="text-gray-600">• {imp}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {turn.aiFeedback.correctedVersion && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <p className="text-xs font-semibold text-green-600 mb-1">✨ 改善された回答:</p>
                                      <p className="text-sm text-gray-700 bg-green-50 p-2 rounded">{turn.aiFeedback.correctedVersion}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Current Follow-up Question */}
                {pendingFollowUp && !pendingFollowUp.evaluation && (
                  <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 mb-4" onMouseUp={handleTextSelection}>
                    <h4 className="font-semibold text-purple-700 mb-2">新しい追問:</h4>
                    <p className="text-gray-800 mb-4">{pendingFollowUp.followUpQuestion}</p>
                    
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-medium text-sm text-gray-700">あなたの回答</label>
                      <div className="flex gap-2">
                        {!isRecording ? (
                          <button
                            onClick={handleStartRecording}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                          >
                            <Mic className="w-4 h-4" />
                            音声で回答
                          </button>
                        ) : (
                          <button
                            onClick={handleStopRecording}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 animate-pulse"
                          >
                            <Mic className="w-4 h-4" />
                            録音中...
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <textarea
                      value={followUpAnswer}
                      onChange={(e) => setFollowUpAnswer(e.target.value)}
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 mb-3"
                      rows={6}
                      placeholder="追問に回答してください..."
                    />
                    
                    <button
                      onClick={handleSubmitFollowUpAnswer}
                      disabled={loading || !followUpAnswer.trim()}
                      className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          評価中...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          回答を提出
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {(!pendingFollowUp || pendingFollowUp.evaluation) && (
                    <button
                      onClick={handleRequestFollowUp}
                      disabled={loading}
                      className="flex-1 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-5 h-5" />
                      さらに追問を受ける
                    </button>
                  )}
                  <button
                    onClick={handleCompleteConversation}
                    disabled={loading}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    対話を完了して保存
                  </button>
                </div>
              </div>
            )}

            {/* Model Answer */}
            {selectedQuestion.model_answer_ja && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <button
                  onClick={() => setShowModelAnswer(!showModelAnswer)}
                  className="flex items-center justify-between w-full mb-4"
                >
                  <h3 className="text-xl font-bold">模範回答を見る</h3>
                  <ChevronRight className={`w-6 h-6 transition-transform ${showModelAnswer ? 'rotate-90' : ''}`} />
                </button>
                
                {showModelAnswer && (
                  <div className="bg-gray-50 border rounded-lg p-4 whitespace-pre-wrap" onMouseUp={handleTextSelection}>
                    {selectedQuestion.model_answer_ja}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setCurrentView('questions')}
              className="w-full bg-gray-200 py-3 rounded-lg hover:bg-gray-300"
            >
              質問一覧に戻る
            </button>
          </div>
        )}

        {/* Favorites View */}
        {currentView === 'favorites' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">お気に入りの質問</h2>

            {favorites.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                お気に入りがありません。質問を★マークでお気に入りに追加してください。
              </div>
            ) : (
              <div className="space-y-6">
                {favorites.map((fav) => {
                  let aiFeedbackData = null;
                  if (fav.ai_feedback) {
                    try {
                      aiFeedbackData = JSON.parse(fav.ai_feedback);
                    } catch (e) {
                      console.error('Failed to parse ai_feedback:', e);
                    }
                  }
                  
                  // Construct question object from favorite data
                  const questionObj = {
                    id: fav.question_id,
                    category: fav.category,
                    question_ja: fav.question_ja,
                    question_zh: fav.question_zh,
                    model_answer_ja: fav.model_answer_ja,
                    tips_ja: fav.tips_ja,
                    summary: fav.summary,
                    user_id: fav.user_id,
                    is_ai_generated: fav.is_ai_generated
                  };
                  
                  return (
                    <div key={fav.id} className="border rounded-lg p-3 md:p-4 bg-gray-50" onMouseUp={handleTextSelection}>
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-1 text-xs rounded ${
                              fav.category === 'HR' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {fav.category || 'HR'}
                            </span>
                            {fav.is_ai_generated === 1 && (
                              <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">AI生成</span>
                            )}
                          </div>
                          <h3 className="font-semibold text-base md:text-lg mb-1">{fav.question_ja}</h3>
                          {fav.question_zh && (
                            <p className="text-gray-600 text-sm mb-2">{fav.question_zh}</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleToggleFavorite(fav.question_id)}
                            className="p-2 text-yellow-500 bg-yellow-50 rounded-lg"
                          >
                            <Star className="w-5 h-5" fill="currentColor" />
                          </button>
                          <button
                            onClick={() => startPractice(questionObj)}
                            className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm md:text-base"
                          >
                            <Play className="w-4 h-4" />
                            練習
                            練習
                          </button>
                        </div>
                      </div>

                      {/* 保存された用户回答 */}
                      {fav.user_answer && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">📝 あなたの回答</h4>
                          <div className="bg-white p-3 rounded border text-sm">
                            {fav.user_answer}
                          </div>
                        </div>
                      )}

                      {/* AIフィードバック */}
                      {aiFeedbackData && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">🤖 AIフィードバック</h4>
                          <div className="bg-blue-50 p-3 rounded space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">スコア:</span>
                              <span className="text-2xl font-bold text-blue-600">{aiFeedbackData.score}/100</span>
                            </div>
                            {aiFeedbackData.feedback && (
                              <div className="text-sm">
                                <span className="font-semibold">評価:</span>
                                <p className="mt-1">{aiFeedbackData.feedback}</p>
                              </div>
                            )}
                            {aiFeedbackData.advice && aiFeedbackData.advice.length > 0 && (
                              <div className="text-sm">
                                <span className="font-semibold">アドバイス:</span>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {aiFeedbackData.advice.map((tip, idx) => (
                                    <li key={idx}>{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* AI修正版 */}
                      {fav.ai_corrected_version && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">✨ 改善された回答</h4>
                          <div className="bg-green-50 p-3 rounded text-sm whitespace-pre-line">
                            {fav.ai_corrected_version}
                          </div>
                        </div>
                      )}

                      {/* 対話履歴 */}
                      {fav.conversation_history && (() => {
                        try {
                          const conversationTurns = JSON.parse(fav.conversation_history);
                          if (conversationTurns && conversationTurns.length > 0) {
                            return (
                              <div className="mt-4 border-t pt-4">
                                <h4 className="font-semibold text-sm text-gray-700 mb-3">💬 対話履歴 ({conversationTurns.length}回のやり取り)</h4>
                                <div className="space-y-3">
                                  {conversationTurns.map((turn, index) => (
                                    <div 
                                      key={index}
                                      className={`p-3 rounded-lg ${
                                        turn.type === 'initial' 
                                          ? 'bg-blue-50 border border-blue-200' 
                                          : 'bg-purple-50 border border-purple-200'
                                      }`}
                                      onMouseUp={handleTextSelection}
                                    >
                                      {/* 追問質問 */}
                                      {turn.followUpQuestion && (
                                        <div className="mb-2">
                                          <p className="text-xs font-semibold text-purple-700 mb-1">
                                            {turn.type === 'initial' ? '初回質問' : `追問 ${index}`}
                                          </p>
                                          <p className="text-sm font-medium text-gray-800">
                                            {turn.followUpQuestion}
                                          </p>
                                        </div>
                                      )}

                                      {/* ユーザーの回答 */}
                                      {turn.userAnswer && (
                                        <div className="mb-2">
                                          <p className="text-xs font-semibold text-gray-600 mb-1">あなたの回答:</p>
                                          <p className="text-sm text-gray-700 whitespace-pre-line bg-white p-2 rounded">
                                            {turn.userAnswer}
                                          </p>
                                        </div>
                                      )}

                                      {/* AIフィードバック */}
                                      {turn.aiFeedback && (
                                        <div>
                                          <p className="text-xs font-semibold text-gray-600 mb-1">AI評価:</p>
                                          <div className="bg-white p-2 rounded">
                                            {turn.aiFeedback.score !== undefined && (
                                              <p className="text-sm mb-1">
                                                <span className="font-semibold">スコア:</span>{' '}
                                                <span className={`${
                                                  turn.aiFeedback.score >= 80 ? 'text-green-600' :
                                                  turn.aiFeedback.score >= 60 ? 'text-yellow-600' :
                                                  'text-red-600'
                                                }`}>
                                                  {turn.aiFeedback.score}/100
                                                </span>
                                              </p>
                                            )}
                                            {turn.aiFeedback.feedback && (
                                              <p className="text-sm text-gray-700 mb-1">{turn.aiFeedback.feedback}</p>
                                            )}
                                            {turn.aiFeedback.strengths && turn.aiFeedback.strengths.length > 0 && (
                                              <div className="mt-1">
                                                <p className="text-xs font-semibold text-green-600">良い点:</p>
                                                <ul className="text-xs text-gray-600 list-disc list-inside">
                                                  {turn.aiFeedback.strengths.map((s, i) => (
                                                    <li key={i}>{s}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                            {turn.aiFeedback.improvements && turn.aiFeedback.improvements.length > 0 && (
                                              <div className="mt-1">
                                                <p className="text-xs font-semibold text-orange-600">改善点:</p>
                                                <ul className="text-xs text-gray-600 list-disc list-inside">
                                                  {turn.aiFeedback.improvements.map((s, i) => (
                                                    <li key={i}>{s}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                            {turn.aiFeedback.correctedVersion && (
                                              <div className="mt-2 pt-2 border-t border-gray-200">
                                                <p className="text-xs font-semibold text-green-600 mb-1">✨ 改善された回答:</p>
                                                <p className="text-xs text-gray-700 bg-green-50 p-2 rounded whitespace-pre-line">
                                                  {turn.aiFeedback.correctedVersion}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      <p className="text-xs text-gray-400 mt-2">
                                        {new Date(turn.timestamp).toLocaleString('ja-JP')}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        } catch (e) {
                          console.error('Failed to parse conversation history:', e);
                        }
                        return null;
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Pagination */}
            <Pagination 
              currentPage={favoritesPage}
              totalItems={favoritesTotal}
              onPageChange={async (page) => {
                setFavoritesPage(page);
                const data = await favoritesAPI.getAll(page, favoritesPerPage);
                setFavorites(data.favorites || data);
                setFavoritesTotal(data.total || (data.favorites || data).length);
              }}
              itemsPerPage={favoritesPerPage}
              onItemsPerPageChange={async (newSize) => {
                setFavoritesPerPage(newSize);
                setFavoritesPage(1);
                const data = await favoritesAPI.getAll(1, newSize);
                setFavorites(data.favorites || data);
                setFavoritesTotal(data.total || (data.favorites || data).length);
              }}
            />
          </div>
        )}

        {/* Resumes View */}
        {currentView === 'resumes' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">履歴書管理</h2>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                <Upload className="w-5 h-5" />
                履歴書をアップロード
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".txt,.pdf,.doc,.docx"
                  className="hidden"
                />
              </label>
            </div>

            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <strong>プライバシー保護:</strong> ファイルは AI によって解析され、重要な情報のみが保存されます。
                元のファイルは保存されません。対応形式: PDF, Word (.doc, .docx), テキスト (.txt)
              </p>
            </div>

            {resumes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                履歴書がアップロードされていません。
              </div>
            ) : (
              <div className="space-y-4">
                {resumes.map((resume) => (
                  <div key={resume.id} className="border rounded-lg p-4" onMouseUp={handleTextSelection}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{resume.filename}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(resume.created_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await resumeAPI.delete(resume.id);
                          const updatedResumes = await resumeAPI.getAll();
                          setResumes(updatedResumes);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {resume.skills && resume.skills.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-1">スキル:</h4>
                          <div className="flex flex-wrap gap-2">
                            {resume.skills.map((skill, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {resume.experience && (
                        <div>
                          <h4 className="font-medium mb-1">経験:</h4>
                          <p className="text-sm text-gray-700">{resume.experience}</p>
                        </div>
                      )}

                      {resume.education && (
                        <div>
                          <h4 className="font-medium mb-1">学歴:</h4>
                          <p className="text-sm text-gray-700">{resume.education}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vocabulary View */}
        {currentView === 'vocabulary' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">単語帳</h2>
              {vocabularyNotes.length > 0 && !reviewMode && (
                <button
                  onClick={startReviewMode}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <RotateCcw className="w-5 h-5" />
                  復習モード
                </button>
              )}
            </div>
            
            {/* Notion Status Banner */}
            {notionEnabled && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2">
                <Book className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-purple-700">
                  <strong>Notion同期:</strong> 有効 - 保存した単語は自動的にNotionデータベースに同期されます
                </span>
              </div>
            )}
            
            {!reviewMode ? (
              <>
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    💡 <strong>使い方:</strong> 質問や説明文で分からない単語を選択すると浮かび上がる放大鏡アイコンをクリックすると、AIが翻訳・解説・例文を提供します。
                  </p>
                </div>

                {vocabularyNotes.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    まだ保存した単語がありません。質問ページで単語を選択して分析・保存してください。
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vocabularyNotes.map((note) => (
                      <div key={note.id} className="border rounded-lg p-3 md:p-4 bg-gray-50" onMouseUp={handleTextSelection}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0 pr-2">
                        <h3 className="text-lg md:text-xl font-bold text-blue-700 mb-1 break-words">{note.word}</h3>
                        <p className="text-sm md:text-base text-gray-600 break-words">{note.translation}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditVocabulary(note)}
                          className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0"
                          title="編集"
                        >
                          <Edit className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVocabulary(note.id)}
                          className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </div>
                    </div>

                    {note.explanation && (
                      <div className="mb-3">
                        <h4 className="font-semibold text-xs md:text-sm mb-1">解説:</h4>
                        <div 
                          className="text-xs md:text-sm text-gray-700 break-words prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: marked.parse(note.explanation) }}
                        />
                      </div>
                    )}

                    {note.example_sentences && note.example_sentences.length > 0 && (
                      <div className="mb-3">
                        <h4 className="font-semibold text-xs md:text-sm mb-2">例文:</h4>
                        <div className="space-y-2">
                          {note.example_sentences.map((example, idx) => (
                            <div key={idx} className="bg-white p-2 md:p-3 rounded text-xs md:text-sm">
                              <p className="text-gray-800 mb-1 break-words">{example.japanese}</p>
                              <p className="text-gray-600 break-words">{example.chinese}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 md:gap-2">
                        {note.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-400">
                      {new Date(note.created_at).toLocaleString('ja-JP')}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Pagination */}
            <Pagination 
              currentPage={vocabularyPage}
              totalItems={vocabularyTotal}
              onPageChange={async (page) => {
                setVocabularyPage(page);
                const data = await vocabularyAPI.getAll(page, vocabularyPerPage);
                setVocabularyNotes(data.notes || data);
                setVocabularyTotal(data.total || (data.notes || data).length);
              }}
              itemsPerPage={vocabularyPerPage}
              onItemsPerPageChange={async (newSize) => {
                setVocabularyPerPage(newSize);
                setVocabularyPage(1);
                const data = await vocabularyAPI.getAll(1, newSize);
                setVocabularyNotes(data.notes || data);
                setVocabularyTotal(data.total || (data.notes || data).length);
              }}
            />
          </>
        ) : (
          <div className="space-y-6">
            {/* Review Mode */}
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-700">
                カード {currentReviewIndex + 1} / {vocabularyNotes.length}
              </div>
              <button
                onClick={exitReviewMode}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                <X className="w-4 h-4" />
                終了
              </button>
            </div>

            {vocabularyNotes.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-lg p-8 min-h-[400px] flex flex-col justify-between">
                {/* Front of card - always show the word */}
                <div className="flex-1 flex flex-col items-center justify-center">
                  <h2 className="text-4xl font-bold text-blue-700 mb-8">
                    {vocabularyNotes[currentReviewIndex].word}
                  </h2>
                  
                  {/* Show/Hide Answer */}
                  {!showAnswer ? (
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 shadow-md"
                    >
                      <Eye className="w-5 h-5" />
                      答えを見る
                    </button>
                  ) : (
                    <div className="w-full space-y-4">
                      <div className="bg-white rounded-lg p-4 shadow">
                        <h3 className="text-sm font-semibold text-gray-600 mb-2">翻訳:</h3>
                        <p className="text-xl text-gray-800">{vocabularyNotes[currentReviewIndex].translation}</p>
                      </div>

                      {vocabularyNotes[currentReviewIndex].explanation && (
                        <div className="bg-white rounded-lg p-4 shadow">
                          <h3 className="text-sm font-semibold text-gray-600 mb-2">解説:</h3>
                          <p className="text-gray-700">{vocabularyNotes[currentReviewIndex].explanation}</p>
                        </div>
                      )}

                      {vocabularyNotes[currentReviewIndex].example_sentences && 
                       vocabularyNotes[currentReviewIndex].example_sentences.length > 0 && (
                        <div className="bg-white rounded-lg p-4 shadow">
                          <h3 className="text-sm font-semibold text-gray-600 mb-2">例文:</h3>
                          <div className="space-y-2">
                            {vocabularyNotes[currentReviewIndex].example_sentences.map((example, idx) => (
                              <div key={idx} className="border-l-2 border-blue-300 pl-3">
                                <p className="text-gray-800 mb-1">{example.japanese}</p>
                                <p className="text-gray-600 text-sm">{example.chinese}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => setShowAnswer(false)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-lg hover:bg-gray-50 shadow text-sm mx-auto"
                      >
                        <EyeOff className="w-4 h-4" />
                        隠す
                      </button>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={prevReviewCard}
                    className="px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 shadow font-medium"
                  >
                    ← 前へ
                  </button>
                  <div className="text-gray-600">
                    {vocabularyNotes[currentReviewIndex].tags && vocabularyNotes[currentReviewIndex].tags.length > 0 && (
                      <div className="flex gap-2">
                        {vocabularyNotes[currentReviewIndex].tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={nextReviewCard}
                    className="px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 shadow font-medium"
                  >
                    次へ →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
          </div>
        )}
      </div>

      {/* Vocabulary Analysis Popup */}
      {showVocabularyPopup && vocabularyAnalysis && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" 
          onClick={() => {
            setShowVocabularyPopup(false);
            setSelectedText('');
            setVocabularyAnalysis(null);
            setFloatingSearchPos(null);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close hint banner */}
            <div className="bg-gray-100 px-6 py-2 text-xs text-gray-600 text-center border-b">
              💡 点击灰色背景关闭 | Click background to close
            </div>
            
            <div className="p-6" onMouseUp={handleTextSelection}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold">単語分析</h3>
                <button 
                  onClick={() => {
                    setShowVocabularyPopup(false);
                    setSelectedText('');
                    setVocabularyAnalysis(null);
                    setFloatingSearchPos(null);
                  }} 
                  className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                  title="关闭"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-bold text-blue-700 mb-2">{selectedText}</h4>
                  <p className="text-lg text-gray-700">{vocabularyAnalysis.translation}</p>
                </div>

                {vocabularyAnalysis.explanation && (
                  <div>
                    <h4 className="font-semibold mb-1">详细解释:</h4>
                    <p className="text-gray-700">{vocabularyAnalysis.explanation}</p>
                  </div>
                )}

                {vocabularyAnalysis.exampleSentences && vocabularyAnalysis.exampleSentences.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">例句:</h4>
                    <div className="space-y-3">
                      {vocabularyAnalysis.exampleSentences.map((example, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-gray-800 mb-1 font-medium">{example.japanese}</p>
                          <p className="text-gray-600">{example.chinese}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {vocabularyAnalysis.tags && vocabularyAnalysis.tags.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">标签:</h4>
                    <div className="flex flex-wrap gap-2">
                      {vocabularyAnalysis.tags.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveVocabulary}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      {notionEnabled ? '保存到单词本 & Notion' : '保存到单词本'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowVocabularyPopup(false);
                    setSelectedText('');
                    setVocabularyAnalysis(null);
                    setFloatingSearchPos(null);
                  }}
                  disabled={loading}
                  className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-all"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Search Icon for Word Selection */}
      {floatingSearchPos && selectedText && (
        <div
          style={{
            position: 'fixed',
            left: `${floatingSearchPos.x}px`,
            top: `${floatingSearchPos.y}px`,
            zIndex: 9999
          }}
          className="animate-fade-in"
        >
          <button
            onClick={handleAnalyzeVocabulary}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-lg disabled:opacity-50 transition-all hover:scale-105"
            title={`分析「${selectedText}」`}
          >
            <Search className="w-4 h-4" />
            <span className="text-sm font-medium">{loading ? '分析中...' : 'AI分析'}</span>
          </button>
        </div>
      )}

      {/* Document Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold mb-4">文書から質問をインポート</h3>
            <p className="text-gray-600 mb-4">
              PDF、Word、テキスト、Markdown形式の文書から質問を抽出します。
              <br/>中国語の質問は自動的に日本語に翻訳されます。
            </p>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block font-medium mb-2">文書ファイル</label>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={(e) => setImportFile(e.target.files[0])}
                className="w-full px-4 py-2 border rounded-lg"
              />
              {importFile && (
                <p className="mt-2 text-sm text-gray-600">
                  選択されたファイル: {importFile.name}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImportQuestions}
                disabled={!importFile || loading}
                className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}
                インポート
              </button>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setError('');
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Analysis Modal */}
      {showAnalysisModal && analyzingQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">AI質問解析</h3>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700 mb-1">質問:</div>
              <div className="text-lg">{analyzingQuestion.question_ja}</div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={generateAnswer}
                  onChange={(e) => setGenerateAnswer(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium">標準回答を生成する</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                チェックを外すと、ヒントと解説のみ生成します
              </p>
            </div>

            <div className="mb-6">
              <label className="block font-medium mb-2">追加のプロンプト（オプション）</label>
              <textarea
                value={analysisPrompt}
                onChange={(e) => setAnalysisPrompt(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                rows={4}
                placeholder="例: 技術的な詳細を含めてください&#10;例: 初心者向けに簡単な表現で"
              />
              <p className="mt-2 text-sm text-gray-600">
                AIに特別な要求がある場合はここに入力してください
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-1">非母語者向け設定</div>
                  <div>生成される回答は日本語学習者（JLPT N2-N1レベル）に適した、理解しやすく実用的な表現になります。</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAnalyzeQuestion}
                disabled={loading}
                className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                解析を開始
              </button>
              <button
                onClick={() => {
                  setShowAnalysisModal(false);
                  setAnalyzingQuestion(null);
                  setAnalysisPrompt('');
                  setError('');
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Generation Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">AI質問生成</h3>
            <p className="text-gray-600 mb-4">
              生成する質問のカテゴリと数量を選択してください
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block font-medium mb-2">カテゴリ</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setGenerateCategory('HR')}
                  className={`p-3 rounded-lg border-2 transition ${
                    generateCategory === 'HR'
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-medium">HR / 一般</div>
                  <div className="text-xs text-gray-600 mt-1">志望動機、性格、価値観</div>
                </button>
                <button
                  onClick={() => setGenerateCategory('Tech')}
                  className={`p-3 rounded-lg border-2 transition ${
                    generateCategory === 'Tech'
                      ? 'border-green-600 bg-green-50 text-green-600'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="font-medium">Tech / 技術</div>
                  <div className="text-xs text-gray-600 mt-1">技術スキル、プロジェクト</div>
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block font-medium mb-2">生成数</label>
              <select
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value={1}>1個</option>
                <option value={2}>2個</option>
                <option value={3}>3個</option>
                <option value={5}>5個</option>
              </select>
            </div>

            {resumes.length > 0 && (
              <div className="mb-6 p-3 bg-green-50 rounded-lg text-sm text-green-800">
                ✓ 履歴書に基づいてパーソナライズされた質問を生成します
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleGenerateQuestions(generateCategory, generateCount)}
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                生成開始
              </button>
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setError('');
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="w-6 h-6" />
                設定
              </h2>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* User Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-3">ユーザー情報</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
                    <input
                      type="email"
                      value={currentUser.email}
                      disabled
                      className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ユーザー名</label>
                    <input
                      type="text"
                      value={settingsForm.username}
                      onChange={(e) => setSettingsForm({ ...settingsForm, username: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="山田太郎"
                    />
                  </div>
                </div>
              </div>

              {/* Notion Integration */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Book className="w-5 h-5" />
                  Notion連携設定（単語帳同期）
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  自分のNotion APIキーとデータベースIDを設定することで、単語帳を個人のNotionデータベースに自動同期できます。
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notion API Key
                      <a 
                        href="https://www.notion.so/my-integrations" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:underline text-xs"
                      >
                        取得方法 →
                      </a>
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={settingsForm.notion_api_key}
                        onChange={(e) => setSettingsForm({ ...settingsForm, notion_api_key: e.target.value })}
                        className="w-full px-4 py-2 pr-10 border rounded-lg font-mono text-sm"
                        placeholder={currentUser.notion_configured ? `現在の設定: ${currentUser.notion_api_key}` : "secret_xxxxxxxxxxxxxxxxx"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 transition"
                        title={showApiKey ? "隠す" : "表示"}
                      >
                        {showApiKey ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {currentUser.notion_configured && (
                      <p className="text-xs text-gray-500 mt-1">
                        💡 空欄のまま保存すると既存の設定を保持します。変更する場合は新しいキーを入力してください。
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notion Database ID
                    </label>
                    <input
                      type="text"
                      value={settingsForm.notion_database_id}
                      onChange={(e) => setSettingsForm({ ...settingsForm, notion_database_id: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
                      placeholder={currentUser.notion_configured ? `現在の設定: ${currentUser.notion_database_id}` : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      NotionデータベースURLの最後の部分（32文字）
                    </p>
                    {currentUser.notion_configured && (
                      <p className="text-xs text-gray-500 mt-1">
                        💡 空欄のまま保存すると既存の設定を保持します。
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>💡 ヒント:</strong> Notionデータベースには以下の列が必要です：
                      <br />• 単語 (Title), 翻訳 (Text), 解説 (Text), 例文 (Text), タグ (Multi-select)
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                保存
              </button>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setError('');
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Coins className="w-6 h-6 text-yellow-500" />
                AIポイント管理
              </h2>
              <button
                onClick={() => setShowCreditsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Credits Balance */}
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-100 mb-1">現在の残高</p>
                    <p className="text-4xl font-bold">{aiCredits} ポイント</p>
                  </div>
                  <button
                    onClick={() => setShowRechargeModal(true)}
                    className="bg-white text-yellow-600 px-6 py-3 rounded-lg hover:bg-yellow-50 transition flex items-center gap-2 font-semibold"
                  >
                    <CreditCard className="w-5 h-5" />
                    チャージ
                  </button>
                </div>
              </div>

              {/* AI Operations Costs */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  AI操作の料金表
                </h3>
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold">操作</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold">説明</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold">消費ポイント</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {creditsCosts.map((cost, index) => (
                        <tr key={index} className="hover:bg-gray-100">
                          <td className="px-4 py-3 font-medium">{cost.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {cost.operation === 'GENERATE_QUESTIONS' && '履歴書に基づいて面接問題を生成'}
                            {cost.operation === 'EVALUATE_ANSWER' && '回答の質を分析・評価'}
                            {cost.operation === 'FOLLOW_UP_QUESTION' && '深掘り追問を生成'}
                            {cost.operation === 'FOLLOW_UP_EVALUATION' && '追問の回答を評価'}
                            {cost.operation === 'ANALYZE_VOCABULARY' && '単語の翻訳・解説・例文を生成'}
                            {cost.operation === 'IMPORT_DOCUMENT' && '文書から面接問題を抽出'}
                            {cost.operation === 'ANALYZE_QUESTION' && '標準答案・技巧・摘要を生成'}
                            {cost.operation === 'PARSE_RESUME' && '履歴書から情報を抽出'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                              <Coins className="w-4 h-4" />
                              {cost.cost}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Usage History */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  使用履歴（最近20件）
                </h3>
                <div className="bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
                  {creditsHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      まだ使用履歴がありません
                    </div>
                  ) : (
                    <div className="divide-y">
                      {creditsHistory.slice(0, 20).map((record) => (
                        <div key={record.id} className="px-4 py-3 hover:bg-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium">
                                {creditsCosts.find(c => c.operation === record.operation_type)?.description || record.operation_type}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{record.description}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {new Date(record.created_at).toLocaleString('ja-JP')}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className={`text-lg font-semibold ${record.credits_cost < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {record.credits_cost < 0 ? '+' : '-'}{Math.abs(record.credits_cost)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {record.credits_before} → {record.credits_after}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowCreditsModal(false)}
                className="w-full bg-gray-200 py-3 rounded-lg hover:bg-gray-300"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <CreditCard className="w-6 h-6" />
                ポイントチャージ
              </h2>
              <button
                onClick={() => {
                  setShowRechargeModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>💡 充值方式：</strong> 请输入您购买的点卡激活码，系统将自动充值对应的积分到您的账户。
                </p>
              </div>

              {/* 点卡兑换表单 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  点卡激活码
                </label>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const cardCode = e.target.cardCode.value.trim();
                  if (cardCode) {
                    handleRedeemCard(cardCode);
                  }
                }}>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      name="cardCode"
                      placeholder="CARD-2024-XXXX-XXXX"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono text-sm"
                      disabled={loading}
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {loading ? '兑换中...' : '兑换'}
                    </button>
                  </div>
                </form>
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
              </div>

              {/* 点卡面值说明 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  点卡面值
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { credits: 100, label: '基础卡', url: 'https://9wa.br3.cn/V' },
                    { credits: 300, label: '标准卡', url: 'https://9wa.br3.cn/d' },
                    { credits: 500, label: '专业卡', url: 'https://9wa.br3.cn/9' },
                    { credits: 1000, label: '企业卡', url: 'https://9wa.br3.cn/S' }
                  ].map((card) => (
                    <a 
                      key={card.credits} 
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white rounded p-3 border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-center cursor-pointer block"
                    >
                      <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                      <div className="text-lg font-bold text-yellow-600">{card.credits}</div>
                      <div className="text-xs text-gray-500">ポイント</div>
                      <div className="text-xs text-blue-600 mt-2">购入 →</div>
                    </a>
                  ))}
                </div>
              </div>

              {/* 测试充值（开发环境） */}
              {/* <div className="border-t pt-4">
                <details className="cursor-pointer">
                  <summary className="text-sm text-gray-600 hover:text-gray-800 font-medium mb-2">
                    🔧 开发测试（直接充值，无需支付）
                  </summary>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[100, 500, 1000].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleRecharge(amount)}
                        disabled={loading}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm disabled:opacity-50"
                      >
                        +{amount}
                      </button>
                    ))}
                  </div>
                </details>
              </div> */}

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 sticky bottom-0">
              <button
                onClick={() => {
                  setShowRechargeModal(false);
                  setError('');
                }}
                className="w-full bg-gray-200 py-3 rounded-lg hover:bg-gray-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vocabulary Edit Modal */}
      {showVocabEditModal && editingVocabulary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">単語を編集</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block font-medium mb-2">単語</label>
                  <input
                    type="text"
                    value={vocabularyForm.word}
                    onChange={(e) => setVocabularyForm({ ...vocabularyForm, word: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block font-medium mb-2">翻訳</label>
                  <input
                    type="text"
                    value={vocabularyForm.translation}
                    onChange={(e) => setVocabularyForm({ ...vocabularyForm, translation: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block font-medium mb-2">解説 (Markdown対応)</label>
                  <textarea
                    value={vocabularyForm.explanation}
                    onChange={(e) => setVocabularyForm({ ...vocabularyForm, explanation: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 h-32"
                    placeholder="**太字** *斜体* `コード` など"
                  />
                  {vocabularyForm.explanation && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">プレビュー:</p>
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: marked.parse(vocabularyForm.explanation) }}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleUpdateVocabulary}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setShowVocabEditModal(false);
                    setEditingVocabulary(null);
                  }}
                  className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Professional Vocabulary Test Modal */}
      {showVocabTest && vocabTestWords.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">🎯 専門用語チェック</h2>
              <p className="text-gray-600 mb-6">
                履歴書に基づいて、{vocabTestWords.length}個の専門用語を選びました。知っている単語をチェックしてください。
                知らない単語は自動的に単語帳に追加されます。
              </p>
              
              <div className="space-y-3 mb-6">
                {vocabTestWords.map((word, index) => (
                  <div 
                    key={index}
                    className="border rounded-lg p-4 hover:border-blue-300 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-blue-700">{word.word}</h3>
                          <span className="text-sm text-gray-600">{word.translation}</span>
                        </div>
                        <p className="text-sm text-gray-700">{word.explanation}</p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => setVocabTestResults({ ...vocabTestResults, [word.word]: true })}
                          className={`px-4 py-2 rounded-lg border-2 transition ${
                            vocabTestResults[word.word] === true
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-300 hover:border-green-500'
                          }`}
                        >
                          知っている
                        </button>
                        <button
                          onClick={() => setVocabTestResults({ ...vocabTestResults, [word.word]: false })}
                          className={`px-4 py-2 rounded-lg border-2 transition ${
                            vocabTestResults[word.word] === false
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 hover:border-blue-500'
                          }`}
                        >
                          知らない
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleVocabTestComplete}
                  disabled={Object.keys(vocabTestResults).length !== vocabTestWords.length}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  完了
                </button>
                <button
                  onClick={() => {
                    setShowVocabTest(false);
                    setVocabTestWords([]);
                    setVocabTestResults({});
                  }}
                  className="px-6 bg-gray-200 py-3 rounded-lg hover:bg-gray-300"
                >
                  スキップ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div 
          className={`fixed top-4 right-4 z-[9999] px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in ${
            toast.type === 'success' ? 'bg-green-500 text-white' :
            toast.type === 'error' ? 'bg-red-500 text-white' :
            toast.type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
          }`}
        >
          {toast.type === 'success' && <Check className="w-5 h-5" />}
          {toast.type === 'error' && <X className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
      
      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          © 2025 日本面接練習器. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default App;

