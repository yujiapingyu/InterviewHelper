import React, { useState, useEffect } from 'react';
import { marked } from 'marked';

// Configure marked.js for better rendering
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false
});
import { 
  User, LogIn, LogOut, BookOpen, Mic, FileText, Star, 
  PlusCircle, Edit, Trash2, Play, ChevronRight, ChevronUp, ChevronDown, Home,
  Upload, RefreshCw, Check, X, Loader2, MessageSquare, Shuffle, Send, Book, Search, RotateCcw, Eye, EyeOff,
  FileUp, Sparkles, Coins, Settings, CreditCard, History, Download
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { auth, questionsAPI, practiceAPI, favoritesAPI, resumeAPI, conversationAPI, vocabularyAPI, creditsAPI, prepPracticeAPI } from './utils/api';
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
  
  // PREP Practice state
  const [showPrepPractice, setShowPrepPractice] = useState(false);
  const [prepStep, setPrepStep] = useState('example'); // 'example', 'practice', 'analysis'
  const [prepQuestion, setPrepQuestion] = useState('');
  const [prepAnswer, setPrepAnswer] = useState('');
  const [prepAnalysis, setPrepAnalysis] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  
  // Onboarding guide state
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);

  // Question expand state
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());

  // Search state
  const [searchKeyword, setSearchKeyword] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [vocabularyPage, setVocabularyPage] = useState(1);
  const [questionsTotal, setQuestionsTotal] = useState(0);
  const [allQuestionsTotal, setAllQuestionsTotal] = useState(0);
  const [hrQuestionsTotal, setHrQuestionsTotal] = useState(0);
  const [techQuestionsTotal, setTechQuestionsTotal] = useState(0);
  const [favoritesTotal, setFavoritesTotal] = useState(0);
  const [vocabularyTotal, setVocabularyTotal] = useState(0);
  const [questionsPerPage, setQuestionsPerPage] = useState(10);
  const [favoritesPerPage, setFavoritesPerPage] = useState(10);
  const [vocabularyPerPage, setVocabularyPerPage] = useState(10);
  const [expandedVocabIds, setExpandedVocabIds] = useState(new Set());

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Multi-language text
  const getText = (key) => {
    const texts = {
      // Navigation
      home: { ja: 'ホーム', zh: '首页' },
      questions: { ja: '質問', zh: '问题' },
      practice: { ja: '練習', zh: '练习' },
      favorites: { ja: 'お気に入り', zh: '收藏' },
      vocabulary: { ja: '単語帳', zh: '单词本' },
      resumes: { ja: '履歴書', zh: '简历' },
      credits: { ja: 'クレジット', zh: '积分' },
      settings: { ja: '設定', zh: '设置' },
      logout: { ja: 'ログアウト', zh: '退出登录' },
      admin: { ja: '管理', zh: '管理' },
      
      // Onboarding
      onboardingUploadTitle: {
        ja: '履歴書をアップロードして、パーソナライズされた面接練習を始めましょう！',
        zh: '上传简历，开始个性化面试练习！',
      },
      uploadResumeDesc: {
        ja: '履歴書をアップロードすると、あなたの経験やスキルに基づいた面接質問が自動生成されます。さらに、専門用語チェックで単語帳を充実させることができます。',
        zh: '上传简历后，系统会根据您的经验和技能自动生成面试问题。此外，您还可以通过专业术语检测来丰富您的单词本。',
      },
      uploadNow: { ja: '今すぐアップロード', zh: '立即上传' },
      
      onboardingTitle: {
        ja: '🎉 専門用語の学習を始めましょう！',
        zh: '🎉 开始学习专业术语吧！',
      },
      onboardingMessage: {
        ja: `おめでとうございます！単語帳に専門用語が追加されました。

次のステップ：
• 📝 質問を生成して、面接練習を始める
• 🔍 質問を分析して、より多くの専門用語を発見
• 💾 重要な単語を保存して、いつでも復習

継続的な学習が、面接成功への鍵です！`,
        zh: `恭喜！已将专业术语添加到单词本。

下一步：
• 📝 生成问题，开始面试练习
• 🔍 分析问题，发现更多专业术语
• 💾 保存重要单词，随时复习

持续学习是面试成功的关键！`,
      },
      gotIt: { ja: '分かりました', zh: '知道了' },
      
      // Login & Register
      appTitle: { ja: '日本面接練習器', zh: '日语面试练习器' },
      appSubtitle: { ja: 'Japanese Interview Coach', zh: 'Japanese Interview Coach' },
      emailLabel: { ja: 'メールアドレス', zh: '邮箱地址' },
      passwordLabel: { ja: 'パスワード', zh: '密码' },
      loginButton: { ja: 'ログイン', zh: '登录' },
      registerButton: { ja: '登録', zh: '注册' },
      createAccount: { ja: 'アカウントを作成', zh: '创建账号' },
      backToLogin: { ja: 'ログインに戻る', zh: '返回登录' },
      newUserRegister: { ja: '新規登録', zh: '新用户注册' },
      createAccountSubtitle: { ja: 'Create Account', zh: 'Create Account' },
      usernameLabel: { ja: 'ユーザー名（任意）', zh: '用户名（可选）' },
      usernamePlaceholder: { ja: '山田太郎', zh: '张三' },
      sendCode: { ja: 'コード送信', zh: '发送验证码' },
      verificationCodeLabel: { ja: '認証コード', zh: '验证码' },
      verificationCodePlaceholder: { ja: '6桁の認証コード', zh: '6位验证码' },
      emailError: { ja: '有効なメールアドレスを入力してください', zh: '请输入有效的邮箱地址' },
      codeSent: { ja: '✉️ 認証コードを送信しました。メールをご確認ください。', zh: '✉️ 验证码已发送，请查收邮件' },
      noChanges: { ja: '変更がありません', zh: '没有修改' },
      settingsSaved: { ja: '✅ 設定を保存しました！', zh: '✅ 设置保存成功！' },
      settingsSaveFailed: { ja: '❌ 設定の保存に失敗しました', zh: '❌ 设置保存失败' },
      loadingFailed: { ja: '❌ 履歴の読み込みに失敗しました', zh: '❌ 加载历史记录失败' },
      loading: { ja: '読み込み中...', zh: '加载中...' },
      
      // Home page
      startInterview: { ja: '面接練習を始めましょう', zh: '开始面试练习' },
      homeDesc: { ja: 'カテゴリを選択して、日本語面接の練習を開始してください。AIがあなたの回答を分析し、フィードバックを提供します。', zh: '选择分类，开始日语面试练习。AI将分析您的回答并提供反馈。' },
      hrCategory: { ja: 'HR / 一般質問', zh: 'HR / 综合问题' },
      hrDesc: { ja: '志望動機、自己PR、キャリアプランなど', zh: '求职动机、自我介绍、职业规划等' },
      techCategory: { ja: 'Tech / 技術質問', zh: 'Tech / 技术问题' },
      techDesc: { ja: 'プロジェクト経験、技術スタック、問題解決など', zh: '项目经验、技术栈、问题解决等' },
      prepMethod: { ja: '💡 PREP法を意識しましょう', zh: '💡 注意使用PREP法' },
      prepPoint: { ja: 'Point: 結論を先に述べる', zh: 'Point: 先说结论' },
      prepReason: { ja: 'Reason: その理由を説明する', zh: 'Reason: 说明理由' },
      prepExample: { ja: 'Example: 具体例を示す', zh: 'Example: 举例说明' },
      prepPointAgain: { ja: 'Point: 再度結論を述べる', zh: 'Point: 再次总结' },
      prepPractice: { ja: 'PREP法を練習', zh: 'PREP法练习' },
      prepExampleTitle: { ja: 'PREP法の例', zh: 'PREP法范例' },
      prepPracticeTitle: { ja: 'PREP法練習', zh: 'PREP法练习' },
      prepYourAnswer: { ja: 'あなたの回答', zh: '你的回答' },
      prepAnswerPlaceholder: { ja: '回答を入力してください（任意の言語で入力できます）', zh: '请输入你的回答（可以使用任何语言）' },
      prepSubmitAnswer: { ja: '回答完了', zh: '回答完毕' },
      prepNextQuestion: { ja: '次の質問', zh: '下一题' },
      prepAnalysisTitle: { ja: 'AI分析結果', zh: 'AI分析结果' },
      prepClose: { ja: '閉じる', zh: '关闭' },
      prepStartPractice: { ja: '練習を始める', zh: '开始练习' },
      prepAnalyzing: { ja: 'AI分析中...', zh: 'AI分析中...' },
      availableQuestions: { ja: '利用可能な質問', zh: '可用问题数' },
      favoritesCount: { ja: 'お気に入り', zh: '收藏数' },
      aiCreditsManagement: { ja: 'AIポイント管理', zh: 'AI积分管理' },
      uploadedResumes: { ja: 'アップロード済み履歴書', zh: '已上传简历' },
      questionCount: { ja: '問', zh: '个问题' },
      
      // Random practice
      randomPractice: { ja: 'ランダム面接練習', zh: '随机面试练习' },
      randomDesc: { ja: 'カテゴリを選択すると、ランダムに質問が選ばれます。実際の面接のような緊張感を体験できます！', zh: '选择分类后，将随机抽取问题。体验真实面试的紧张感！' },
      allQuestions: { ja: 'すべての質問', zh: '所有问题' },
      randomFromAll: { ja: 'HRとTechからランダム', zh: '从HR和Tech中随机' },
      hrQuestions: { ja: 'HR質問', zh: 'HR问题' },
      techQuestions: { ja: 'Tech質問', zh: 'Tech问题' },
      
      // Question management
      questionManagement: { ja: '質問管理', zh: '问题管理' },
      manualAdd: { ja: '手動追加', zh: '手动添加' },
      addButton: { ja: '追加', zh: '添加' },
      editQuestion: { ja: '質問を編集', zh: '编辑问题' },
      addNewQuestion: { ja: '新しい質問を追加', zh: '添加新问题' },
      categoryLabel: { ja: 'カテゴリ', zh: '分类' },
      hrGeneral: { ja: 'HR / 一般', zh: 'HR / 综合' },
      techTechnical: { ja: 'Tech / 技術', zh: 'Tech / 技术' },
      questionJa: { ja: '質問（日本語）', zh: '问题（日语）' },
      questionZh: { ja: '質問（中国語）', zh: '问题（中文）' },
      modelAnswer: { ja: '模範回答（PREP法）', zh: '标准答案（PREP法）' },
      answerTips: { ja: '回答のコツ（カンマ区切り）', zh: '回答技巧（逗号分隔）' },
      tipsPlaceholder: { ja: 'コツ1, コツ2, コツ3', zh: '技巧1, 技巧2, 技巧3' },
      summaryLabel: { ja: '要約（英語、AI重複チェック用）', zh: '摘要（英文，用于AI去重）' },
      saveButton: { ja: '保存', zh: '保存' },
      cancelButton: { ja: 'キャンセル', zh: '取消' },
      
      // Practice page
      aiGenerated: { ja: 'AI生成', zh: 'AI生成' },
      answerTipsTitle: { ja: '💡 回答のコツ', zh: '💡 回答技巧' },
      yourAnswer: { ja: 'あなたの回答', zh: '你的回答' },
      voiceAnswer: { ja: '音声で回答', zh: '语音回答' },
      recording: { ja: '録音中...', zh: '录音中...' },
      answerPlaceholder: { ja: 'ここに回答を入力してください。音声で回答することもできます。', zh: '请在此输入回答。您也可以使用语音回答。' },
      answerRequired: { ja: '回答を入力してください', zh: '请输入回答' },
      
      // Practice page - more
      aiAnalyzing: { ja: 'AIが分析中...', zh: 'AI分析中...' },
      getFeedback: { ja: 'AIフィードバックを取得', zh: '获取AI反馈' },
      skipToNext: { ja: '次へスキップ', zh: '跳到下一题' },
      aiFeedback: { ja: 'AIフィードバック', zh: 'AI反馈' },
      score: { ja: 'スコア', zh: '得分' },
      goodPoints: { ja: '良い点', zh: '优点' },
      improvements: { ja: '改善点', zh: '改进点' },
      questionsGenerated: { ja: '個の新しい', zh: '个新' },
      questionsGeneratedSuffix: { ja: '質問を生成しました！', zh: '問題已生成！' },
      aiQuestionGen: { ja: 'AI質問生成', zh: 'AI问题生成' },
      
      // Empty states
      noQuestions: { ja: '質問がありません。AI生成または手動で追加してください。', zh: '暂无问题。请使用AI生成或手动添加。' },
      noQuestionsInCategory: { ja: 'このカテゴリに質問がありません', zh: '该分类下暂无问题' },
      noFavorites: { ja: 'お気に入りがありません。質問を★マークでお気に入りに追加してください。', zh: '暂无收藏。点击问题的★标记添加到收藏。' },
      
      // Vocabulary help
      vocabHelpTitle: { ja: '💡 使い方', zh: '💡 使用方法' },
      vocabHelpDesc: { ja: '質問や説明文で分からない単語を選択すると浮かび上がる放大鏡アイコンをクリックすると、AIが翻訳・解説・例文を提供します。', zh: '选中问题或说明中不懂的单词，点击弹出的放大镜图标，AI将提供翻译、解释和例句。' },
      
      // Vocabulary analysis
      analyzing: { ja: '分析中...', zh: '分析中...' },
      aiAnalyze: { ja: 'AI分析', zh: 'AI分析' },
      analyzeWord: { ja: '分析', zh: '分析' },
      
      // Misc
      confirmDelete: { ja: '本当にこの質問を削除しますか？', zh: '确定要删除这个问题吗？' },
      deleteFailed: { ja: '質問の削除に失敗しました', zh: '删除问题失败' },
      selectCategory: { ja: '生成する質問のカテゴリと数量を選択してください', zh: '请选择生成问题的分类和数量' },
      displayLanguage: { ja: '🌏 表示言語 / Display Language', zh: '🌏 显示语言 / Display Language' },
      selectDisplayLang: { ja: 'システムの表示言語を選択してください', zh: '选择系统显示语言' },
      showHide: { ja: '表示', zh: '显示' },
      hide: { ja: '隠す', zh: '隐藏' },
      closeButton: { ja: '閉じる', zh: '关闭' },
      editButton: { ja: '編集', zh: '编辑' },
      deleteButton: { ja: '削除', zh: '删除' },
      editWord: { ja: '単語を編集', zh: '编辑单词' },
      perPage: { ja: '件/ページ', zh: '条/页' },
      pageOf: { ja: 'ページ', zh: '页' },
      itemsCount: { ja: '件', zh: '条' },
      points: { ja: 'ポイント', zh: '积分' },
      importDoc: { ja: '文書導入', zh: '导入文档' },
      import: { ja: '導入', zh: '导入' },
      aiGenShort: { ja: 'AI生成', zh: 'AI生成' },
      practiceShort: { ja: '練習', zh: '练习' },
      modelAnswerLabel: { ja: '📝 模範回答', zh: '📝 标准答案' },
      answerPointsLabel: { ja: '💡 回答のポイント', zh: '💡 回答要点' },
      yourAnswerLabel: { ja: 'あなたの回答', zh: '你的回答' },
      overallComment: { ja: '総評', zh: '总评' },
      improvementAdvice: { ja: '改善アドバイス', zh: '改进建议' },
      revisedVersion: { ja: '修正版（商務日本語）', zh: '修订版（商务日语）' },
      secondsShort: { ja: 's', zh: '秒' },
      
      // Credits
      currentBalance: { ja: '現在の残高', zh: '当前余额' },
      recharge: { ja: 'チャージ', zh: '充值' },
      pointRecharge: { ja: 'ポイントチャージ', zh: '积分充值' },
      
      // Favorites
      favoriteQuestions: { ja: 'お気に入りの質問', zh: '收藏的问题' },
      viewModelAnswer: { ja: '模範回答を見る', zh: '查看标准答案' },
      backToQuestionList: { ja: '質問一覧に戻る', zh: '返回问题列表' },
      improvedAnswer: { ja: '改善された回答', zh: '改进后的答案' },
      evaluation: { ja: '評価', zh: '评价' },
      advice: { ja: 'アドバイス', zh: '建议' },
      aiEvaluation: { ja: 'AI評価', zh: 'AI评价' },
      
      // Resume upload
      resumeManagement: { ja: '履歴書管理', zh: '简历管理' },
      uploadResume: { ja: '履歴書をアップロード', zh: '上传简历' },
      privacyProtection: { ja: 'プライバシー保護:', zh: '隐私保护:' },
      privacyDesc: { 
        ja: 'ファイルは AI によって解析され、重要な情報のみが保存されます。元のファイルは保存されません。',
        zh: '文件将由AI解析，仅保存关键信息。不保存原始文件。' 
      },
      uploadDocTypes: {
        ja: '📄 アップロード可能な書類：履歴書、職務経歴書、学習記録、プロジェクト資料など、あなたの経験やスキルが記載された文書。対応形式: PDF, Word (.doc, .docx), テキスト (.txt)',
        zh: '📄 可上传文档：简历、职务经历书、学习记录、项目资料等，任何包含您经验和技能的文档。支持格式：PDF、Word (.doc, .docx)、文本 (.txt)'
      },
      noResumesUploaded: { ja: '履歴書がアップロードされていません。', zh: '暂未上传简历。' },
      noUsageHistory: { ja: 'まだ使用履歴がありません', zh: '暂无使用记录' },
      
      // Search & Review
      searchPlaceholder: { ja: 'キーワードで検索... (質問、回答、要点)', zh: '关键词搜索...（问题、答案、要点）' },
      reviewMode: { ja: '復習モード', zh: '复习模式' },
      searchButton: { ja: '検索', zh: '搜索' },

      // AI Analysis Modal
      aiQuestionAnalysis: { ja: 'AI質問解析', zh: 'AI问题解析' },
      questionLabel: { ja: '質問:', zh: '问题：' },
      generateStandardAnswer: { ja: '標準回答を生成する', zh: '生成标准答案' },
      generateHintsOnly: { ja: 'チェックを外すと、ヒントと解説のみ生成します', zh: '取消勾选后，仅生成提示和解说' },
      additionalPrompt: { ja: '追加のプロンプト（オプション）', zh: '附加提示（可选）' },
      promptPlaceholder: { ja: '例: 技術的な詳細を含めてください\n例: 初心者向けに簡単な表現で', zh: '例如：请包含技术细节\n例如：请用简单易懂的表达' },
      promptHint: { ja: 'AIに特別な要求がある場合はここに入力してください', zh: '如有对AI的特殊要求，请在此输入' },
      nonNativeSetting: { ja: '非母語者向け設定', zh: '非母语者设置' },
      nonNativeDesc: { ja: '生成される回答は日本語学習者（JLPT N2-N1レベル）に適した、理解しやすく実用的な表現になります。', zh: '生成的答案将适合日语学习者（JLPT N2-N1级别），使用易懂且实用的表达。' },
      startAnalysis: { ja: '解析を開始', zh: '开始解析' },

      // Generate Questions Modal (reusing hrGeneral, techCategory from above)
      hrDesc2: { ja: '志望動機、性格、価値観', zh: '求职动机、性格、价值观' },
      techDesc2: { ja: '技術スキル、プロジェクト', zh: '技术能力、项目经验' },
      generateCount: { ja: '生成数', zh: '生成数量' },
      countUnit: { ja: '個', zh: '个' },
      resumePersonalized: { ja: '履歴書に基づいてパーソナライズされた質問を生成します', zh: '将基于简历生成个性化问题' },
      startGenerate: { ja: '生成開始', zh: '开始生成' },

      // Import Modal
      importFromDocument: { ja: '文書から質問をインポート', zh: '从文档导入问题' },
      documentFile: { ja: '文書ファイル', zh: '文档文件' },
      selectedFile: { ja: '選択されたファイル', zh: '已选择文件' },
      importButton: { ja: 'インポート', zh: '导入' },
      importError: { ja: '文書のインポートに失敗しました', zh: '文档导入失败' },

      // Settings Modal
      saveSettings: { ja: '保存', zh: '保存' },
      keepExisting: { ja: '空欄のまま保存すると既存の設定を保持します。', zh: '留空则保持现有设置。' },
      keepExistingChange: { ja: '空欄のまま保存すると既存の設定を保持します。変更する場合は新しいキーを入力してください。', zh: '留空则保持现有设置。如需更改请输入新密钥。' },
      notionDbUrl: { ja: 'NotionデータベースURLの最後の部分（32文字）', zh: 'Notion数据库URL的最后部分（32个字符）' },
      notionHint: { ja: 'Notionデータベースには以下の列が必要です', zh: 'Notion数据库需要以下列' },
      notionColumns: { ja: '単語 (Title), 翻訳 (Text), 解説 (Text), 例文 (Text), タグ (Multi-select)', zh: '单词 (Title), 翻译 (Text), 解说 (Text), 例文 (Text), タグ (Multi-select)' },

      // Resume fields
      skillsLabel: { ja: 'スキル:', zh: '技能：' },
      experienceLabel: { ja: '経験:', zh: '经验：' },
      educationLabel: { ja: '学歴:', zh: '学历：' },

      // Vocabulary Edit Modal
      wordLabel: { ja: '単語', zh: '单词' },
      translationLabel: { ja: '翻訳', zh: '翻译' },
      explanationLabel: { ja: '解説 (Markdown対応)', zh: '解说 (支持Markdown)' },
      markdownPlaceholder: { ja: '**太字** *斜体* `コード` など', zh: '**粗体** *斜体* `代码` 等' },
      preview: { ja: 'プレビュー:', zh: '预览：' },

      // Vocabulary Page
      vocabularyPageTitle: { ja: '単語帳', zh: '单词本' },
      notionSyncEnabled: { ja: 'Notion同期: 有効 - 保存した単語は自動的にNotionデータベースに同期されます', zh: 'Notion同步：已启用 - 保存的单词将自动同步到Notion数据库' },
      noVocabulary: { ja: 'まだ保存した単語がありません。質問ページで単語を選択して分析・保存してください。', zh: '还没有保存的单词。请在问题页面选择单词进行分析和保存。' },
      exampleLabel: { ja: '例文:', zh: '例句：' },
      exportVocabulary: { ja: '単語帳をエクスポート', zh: '导出单词本' },
      exportSuccess: { ja: '✅ 単語帳をエクスポートしました！', zh: '✅ 单词本导出成功！' },
      vocabularyLimitReached: { ja: '単語帳の上限（1000個）に達しました。不要な単語を削除してから追加してください。', zh: '单词本已达上限（1000个）。请先删除不需要的单词再添加。' },
      
      // Error messages  
      insufficientCredits: { ja: 'API エラー: Insufficient AI credits', zh: 'API错误：积分不足' },
      generateQuestionError: { ja: '質問の生成に失敗しました', zh: '问题生成失败' },
      updateWordError: { ja: '単語の更新に失敗しました', zh: '更新单词失败' },
      saveError: { ja: '保存失败', zh: '保存失败' },
      randomQuestionError: { ja: 'ランダム質問の取得に失敗しました', zh: '随机问题获取失败' },
      nextQuestionError: { ja: '次の質問の取得に失敗しました', zh: '下一个问题获取失败' },
      voiceRecognitionError: { ja: '音声認識エラー', zh: '语音识别错误' },
      voiceStartError: { ja: '音声認識の開始に失敗しました', zh: '语音识别启动失败' },
      feedbackError: { ja: 'AIフィードバックの取得に失敗しました', zh: 'AI反馈获取失败' },
      submitFirstAnswer: { ja: 'まず最初の回答を提出してください', zh: '请先提交第一个回答' },
      conversationStartError: { ja: '対話モードの開始に失敗しました', zh: '对话模式启动失败' },
      conversationNotEnabled: { ja: '対話モードが有効になっていません', zh: '对话模式未启用' },
      followUpError: { ja: '追問の生成に失敗しました', zh: '追问生成失败' },

      // Toast messages
      excellentAnswer: { ja: '🎉 素晴らしい回答です！この質問の練習は完了です。', zh: '🎉 出色的回答！该问题练习完成。' },
      savedToFavorites: { ja: '⭐ 対話を完了し、お気に入りに保存しました！', zh: '⭐ 对话完成，已保存到收藏！' },
      noWordsSelected: { ja: '⚠️ 保存失败：没有选择单词', zh: '⚠️ 保存失败：没有选择单词' },
      savedToNotion: { ja: '✅ 保存成功！已同步到Notion', zh: '✅ 保存成功！已同步到Notion' },
      savedToLocal: { ja: '✅ 已保存到本地数据库', zh: '✅ 已保存到本地数据库' },
      savedSuccess: { ja: '✅ 保存成功！', zh: '✅ 保存成功！' },
      saveFailed: { ja: '❌ 保存失败', zh: '❌ 保存失败' },
      noWordsToReview: { ja: '📚 还没有单词可以复习！', zh: '📚 还没有单词可以复习！' },
      analysisComplete: { ja: '✅ 質問の解析が完了しました！', zh: '✅ 问题解析完成！' },
      resumeUploaded: { ja: '✅ 履歴書を正常にアップロードしました！', zh: '✅ 简历上传成功！' },
      rechargeFailed: { ja: '充值失败', zh: '充值失败' },
      exchangeFailed: { ja: '兑换失败', zh: '兑换失败' },
    };
    
    // Default to Chinese, fallback to Japanese
    const lang = currentUser?.target_language || 'zh';
    return texts[key]?.[lang] || texts[key]?.['zh'] || '';
  };

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
      const [questionsData, hrData, techData, favoritesData, resumesData, vocabularyData, notionStatus, costsData] = await Promise.all([
        questionsAPI.getAll(null, currentPage, questionsPerPage, searchKeyword),
        questionsAPI.getAll('HR', 1, 1, ''),
        questionsAPI.getAll('Tech', 1, 1, ''),
        favoritesAPI.getAll(favoritesPage, favoritesPerPage),
        resumeAPI.getAll(),
        vocabularyAPI.getAll(vocabularyPage, vocabularyPerPage),
        vocabularyAPI.getNotionStatus(),
        creditsAPI.getCosts()
      ]);
      
      setQuestions(questionsData.questions || questionsData);
      setQuestionsTotal(questionsData.total || (questionsData.questions || questionsData).length);
      setAllQuestionsTotal(questionsData.total || (questionsData.questions || questionsData).length);
      setHrQuestionsTotal(hrData.total || 0);
      setTechQuestionsTotal(techData.total || 0);
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
      setError(getText('emailError'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      await auth.sendVerificationCode(email);
      setCodeSent(true);
      setCountdown(60);
      showToast(getText('codeSent'), 'success');
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

  // PREP Practice handlers
  const startPrepPractice = async () => {
    setShowPrepPractice(true);
    setPrepStep('example');
    setPrepAnswer('');
    setPrepAnalysis(null);
    setPrepQuestion('');
  };

  const handlePrepStartPractice = async () => {
    setPrepLoading(true);
    try {
      const data = await prepPracticeAPI.getQuestion();
      setPrepQuestion(data.question);
      setPrepStep('practice');
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setPrepLoading(false);
    }
  };

  const handlePrepSubmitAnswer = async () => {
    if (!prepAnswer.trim()) return;
    
    setPrepLoading(true);
    try {
      const data = await prepPracticeAPI.analyzeAnswer(prepQuestion, prepAnswer);
      setPrepAnalysis(data);
      setPrepStep('analysis');
      await loadUserData();
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setPrepLoading(false);
    }
  };

  const handlePrepNextQuestion = () => {
    setPrepAnswer('');
    setPrepAnalysis(null);
    handlePrepStartPractice();
  };

  // Settings handlers
  const handleOpenSettings = () => {
    setSettingsForm({
      notion_api_key: '', // Don't prefill truncated value
      notion_database_id: '', // Don't prefill truncated value  
      username: currentUser.username || '',
      target_language: currentUser.target_language || 'ja'
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
      
      if (settingsForm.target_language && settingsForm.target_language !== currentUser.target_language) {
        payload.target_language = settingsForm.target_language;
      }
      
      // Only update Notion keys if user has entered something
      if (settingsForm.notion_api_key && settingsForm.notion_api_key.trim()) {
        payload.notion_api_key = settingsForm.notion_api_key.trim();
      }
      
      if (settingsForm.notion_database_id && settingsForm.notion_database_id.trim()) {
        payload.notion_database_id = settingsForm.notion_database_id.trim();
      }
      
      if (Object.keys(payload).length === 0) {
        showToast(getText('noChanges'), 'warning');
        setShowSettingsModal(false);
        return;
      }
      
      const updatedUser = await auth.updateSettings(payload);
      setCurrentUser(updatedUser);
      setNotionEnabled(updatedUser.notion_configured);
      setShowSettingsModal(false);
      
      const lang = updatedUser.target_language || 'zh';
      const message = lang === 'zh' ? getText('settingsSaved') : getText('settingsSaved');
      showToast(message, 'success');
    } catch (err) {
      setError(err.message);
      showToast(getText('settingsSaveFailed') + ': ' + err.message, 'error');
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
      showToast(getText('loadingFailed') + ': ' + err.message, 'error');
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
        setError(getText('noQuestionsInCategory'));
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
        setError(getText('noQuestionsInCategory'));
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
      setError(getText('answerRequired'));
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
      setError(getText('answerRequired'));
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
        showToast('🎉 素晴らしい回答です！この質問の練習は完了です。', 'success');
        setSelectedQuestion(null);
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
      
      showToast('⭐ 対話を完了し、お気に入りに保存しました！', 'success');
      
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
    // Add a small delay to ensure selection is complete on mobile
    setTimeout(() => {
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
    }, 10);
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
      showToast('⚠️ 保存失败：没有选择单词', 'warning');
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
      
      // Check if it's a limit error
      if (err.response?.data?.limit_reached) {
        const errorMsg = err.response.data[currentUser?.target_language === 'ja' ? 'error' : 'error_zh'] || getText('vocabularyLimitReached');
        setError(errorMsg);
        showToast('⚠️ ' + errorMsg, 'warning');
      } else {
        setError(getText('saveFailed') + ': ' + err.message);
        showToast('❌ ' + getText('saveFailed') + ': ' + err.message, 'error');
      }
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
      showToast('📚 还没有单词可以复习！', 'warning');
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
    if (!confirm(getText('confirmDelete'))) return;

    try {
      await questionsAPI.delete(questionId);
      const updatedQuestions = await questionsAPI.getAll(categoryFilter === 'all' ? null : categoryFilter, currentPage, questionsPerPage, searchKeyword);
      setQuestions(updatedQuestions.questions || updatedQuestions);
      setQuestionsTotal(updatedQuestions.total || (updatedQuestions.questions || updatedQuestions).length);
    } catch (err) {
      setError(getText('deleteFailed') + ': ' + err.message);
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
      
      showToast(`✨ ${count}${getText('questionsGenerated')}${category}${getText('questionsGeneratedSuffix')}`, 'success');
    } catch (err) {
      console.error('Generate questions error:', err);
      
      // Check if it's a resume required error
      if (err.message && err.message.includes('Resume required')) {
        const lang = currentUser?.target_language || 'ja';
        const message = lang === 'zh' 
          ? '⚠️ 请先上传简历再生成问题。简历可以帮助我们生成更符合您背景的面试问题。'
          : '⚠️ 質問を生成する前に履歴書をアップロードしてください。履歴書があれば、あなたの背景に合った面接質問を生成できます。';
        showToast(message, 'warning');
        setShowGenerateModal(false);
        setTimeout(() => setCurrentView('resumes'), 1500);
      } else {
        setError('質問の生成に失敗しました: ' + err.message);
      }
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
      showToast(result.message, 'success');
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
      
      showToast('✅ 質問の解析が完了しました！', 'success');
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
      
      // Refresh user credits after upload
      const user = await auth.getCurrentUser();
      if (user) {
        setAiCredits(user.ai_credits || 0);
      }
      
      setError('');
      showToast('✅ 履歴書を正常にアップロードしました！', 'success');
      
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
        let savedCount = 0;
        let limitReached = false;
        
        for (const wordData of unknownWords) {
          try {
            await vocabularyAPI.save(wordData);
            savedCount++;
          } catch (err) {
            if (err.response?.data?.limit_reached) {
              limitReached = true;
              break;
            }
          }
        }
        
        const updatedVocab = await vocabularyAPI.getAll(vocabularyPage, vocabularyPerPage);
        setVocabularyNotes(updatedVocab.notes || updatedVocab);
        setVocabularyTotal(updatedVocab.total || (updatedVocab.notes || updatedVocab).length);
        
        if (limitReached) {
          showToast(`⚠️ ${getText('vocabularyLimitReached')} (已保存${savedCount}个)`, 'warning');
        } else if (savedCount > 0) {
          showToast(`📚 ${savedCount}個の専門用語を単語帳に追加しました！`, 'success');
          // Show onboarding guide after completing vocab test
          setTimeout(() => setShowOnboardingGuide(true), 1000);
        }
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

  // Export vocabulary to CSV
  const handleExportVocabulary = async () => {
    try {
      // Fetch all vocabulary (not just current page)
      const allVocabData = await vocabularyAPI.getAll(1, vocabularyTotal || 10000);
      const allVocab = allVocabData.notes || allVocabData;
      
      // Create CSV content
      const headers = ['Word', 'Translation', 'Explanation', 'Example', 'Tags', 'Created At'];
      const rows = allVocab.map(vocab => [
        vocab.word || '',
        vocab.translation || '',
        (vocab.explanation || '').replace(/\n/g, ' ').replace(/"/g, '""'),
        (vocab.example_sentence || '').replace(/\n/g, ' ').replace(/"/g, '""'),
        (vocab.tags || []).join('; '),
        new Date(vocab.created_at).toLocaleDateString()
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Add BOM for proper UTF-8 encoding in Excel
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vocabulary_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast(getText('exportSuccess'), 'success');
    } catch (err) {
      console.error('Export failed:', err);
      setError('导出失败: ' + err.message);
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 py-4 border-t sticky bottom-0 bg-white z-10">
        <div className="flex items-center gap-2">
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
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {currentPage} / {totalPages} {getText('pageOf')} ({totalItems}{getText('itemsCount')})
          </span>
          
          {onItemsPerPageChange && (
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value={10}>10{getText('perPage')}</option>
              <option value={20}>20{getText('perPage')}</option>
              <option value={50}>50{getText('perPage')}</option>
              <option value={100}>100{getText('perPage')}</option>
            </select>
          )}
        </div>
      </div>
    );
  };

  // Login View (shortened for brevity - keeping same structure)
  if (!currentUser && currentView === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{getText('appTitle')}</h1>
            <p className="text-gray-600">{getText('appSubtitle')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{getText('emailLabel')}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{getText('passwordLabel')}</label>
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
              {getText('loginButton')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setCurrentView('register')}
              className="text-blue-600 hover:underline"
            >
              {getText('createAccount')}
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
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{getText('newUserRegister')}</h1>
            <p className="text-gray-600">{getText('createAccountSubtitle')}</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{getText('usernameLabel')}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={getText('usernamePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{getText('emailLabel')}</label>
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
                  {countdown > 0 ? `${countdown}${getText('secondsShort')}` : getText('sendCode')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{getText('verificationCodeLabel')}</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={getText('verificationCodePlaceholder')}
                required
                maxLength={6}
                pattern="\d{6}"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{getText('passwordLabel')}</label>
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
              {getText('registerButton')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setCurrentView('login')}
              className="text-blue-600 hover:underline"
            >
              {getText('backToLogin')}
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
          <p className="text-gray-600">{getText('loading')}</p>
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
              <h1 className="text-base md:text-2xl font-bold text-gray-800 truncate">{getText('appTitle')}</h1>
              <div className="flex items-center gap-1.5 md:gap-2 hidden sm:flex">
                <img 
                  src="/logo.jpg" 
                  alt="Logo" 
                  className="w-6 h-6 md:w-7 md:h-7 rounded-full object-cover shadow-sm"
                />
                <span className="text-xs md:text-sm text-gray-500">ようこそ、{currentUser.username}さん</span>
              </div>
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
                <span className="text-xs hidden md:inline">{getText('points')}</span>
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
                {getText('logout')}
              </button>
              <button
                onClick={handleLogout}
                className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                title={getText('logout')}
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
            <span className="hidden sm:inline">{getText('home')}</span>
          </button>
          <button
            onClick={() => setCurrentView('random')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'random' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Shuffle className="w-5 h-5" />
            <span className="hidden sm:inline">{getText('practice')}</span>
            <span className="sm:hidden">{getText('practice')}</span>
          </button>
          <button
            onClick={() => setCurrentView('questions')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'questions' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="hidden sm:inline">{getText('questions')}</span>
            <span className="sm:hidden">{getText('questions')}</span>
          </button>
          <button
            onClick={() => setCurrentView('favorites')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'favorites' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Star className="w-5 h-5" />
            <span className="hidden sm:inline">{getText('favorites')} ({favorites.length})</span>
            <span className="sm:hidden">★ {favorites.length}</span>
          </button>
          <button
            onClick={() => setCurrentView('vocabulary')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'vocabulary' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Book className="w-5 h-5" />
            <span className="hidden sm:inline">{getText('vocabulary')} ({vocabularyTotal})</span>
            <span className="sm:hidden">{getText('vocabulary')} {vocabularyTotal}</span>
          </button>
          <button
            onClick={() => setCurrentView('resumes')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentView === 'resumes' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="hidden sm:inline">{getText('resumes')} ({resumes.length})</span>
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
            <div className="bg-white rounded-lg shadow-sm p-6" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
              <h2 className="text-2xl font-bold mb-4">{getText('randomPractice')}</h2>
              <p className="text-gray-600 mb-6">
                {getText('randomDesc')}
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => startRandomPractice('all')}
                  disabled={loading}
                  className="border-2 border-purple-200 rounded-lg p-6 hover:border-purple-400 transition disabled:opacity-50"
                >
                  <div className="text-center">
                    <Shuffle className="w-12 h-12 mx-auto mb-3 text-purple-600" />
                    <h3 className="text-xl font-semibold mb-2">{getText('allQuestions')}</h3>
                    <p className="text-gray-600 text-sm mb-4">{getText('randomFromAll')}</p>
                    <div className="text-purple-600 font-medium">{questions.length} {getText('questionCount')}</div>
                  </div>
                </button>

                <button
                  onClick={() => startRandomPractice('HR')}
                  disabled={loading}
                  className="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition disabled:opacity-50"
                >
                  <div className="text-center">
                    <User className="w-12 h-12 mx-auto mb-3 text-blue-600" />
                    <h3 className="text-xl font-semibold mb-2">{getText('hrQuestions')}</h3>
                    <p className="text-gray-600 text-sm mb-4">{getText('hrDesc')}</p>
                    <div className="text-blue-600 font-medium">
                      {questions.filter(q => q.category === 'HR').length} {getText('questionCount')}
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
                    <h3 className="text-xl font-semibold mb-2">{getText('techQuestions')}</h3>
                    <p className="text-gray-600 text-sm mb-4">{getText('techDesc')}</p>
                    <div className="text-green-600 font-medium">
                      {questions.filter(q => q.category === 'Tech').length} {getText('questionCount')}
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
                    <h3 className="text-xl font-bold mb-2">🎯 {getText('onboardingUploadTitle')}</h3>
                    <p className="text-gray-700 mb-4">
                      {getText('uploadResumeDesc')}
                    </p>
                    <button
                      onClick={() => setCurrentView('resumes')}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold"
                    >
                      <Upload className="w-5 h-5" />
                      {getText('uploadNow')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-white rounded-lg shadow-sm p-6" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
              <h2 className="text-2xl font-bold mb-4">{getText('startInterview')}</h2>
              <p className="text-gray-600 mb-6">
                {getText('homeDesc')}
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition cursor-pointer flex items-stretch gap-4"
                     onClick={() => { setCategoryFilter('HR'); setCurrentView('questions'); }}>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{getText('hrCategory')}</h3>
                    <p className="text-gray-600 mb-4">{getText('hrDesc')}</p>
                    <div className="text-blue-600 font-medium">
                      {questions.filter(q => q.category === 'HR').length} {getText('questionCount')}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <img 
                      src="/resources/HR.png" 
                      alt="HR" 
                      className="h-full w-auto object-contain"
                      style={{ maxWidth: '80px' }}
                    />
                  </div>
                </div>

                <div className="border-2 border-green-200 rounded-lg p-6 hover:border-green-400 transition cursor-pointer flex items-stretch gap-4"
                     onClick={() => { setCategoryFilter('Tech'); setCurrentView('questions'); }}>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{getText('techCategory')}</h3>
                    <p className="text-gray-600 mb-4">{getText('techDesc')}</p>
                    <div className="text-green-600 font-medium">
                      {questions.filter(q => q.category === 'Tech').length} {getText('questionCount')}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <img 
                      src="/resources/専門.png" 
                      alt="Tech" 
                      className="h-full w-auto object-contain"
                      style={{ maxWidth: '80px' }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold">{getText('prepMethod')}</h4>
                  <button
                    onClick={startPrepPractice}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    {getText('prepPractice')}
                  </button>
                </div>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li><strong>Point:</strong> {getText('prepPoint').replace('Point: ', '')}</li>
                  <li><strong>Reason:</strong> {getText('prepReason').replace('Reason: ', '')}</li>
                  <li><strong>Example:</strong> {getText('prepExample').replace('Example: ', '')}</li>
                  <li><strong>Point:</strong> {getText('prepPointAgain').replace('Point: ', '')}</li>
                </ul>
              </div>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-3xl font-bold text-blue-600">{questions.length}</div>
                <div className="text-gray-600">{getText('availableQuestions')}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-3xl font-bold text-green-600">{favorites.length}</div>
                <div className="text-gray-600">{getText('favoritesCount')}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-3xl font-bold text-purple-600">{resumes.length}</div>
                <div className="text-gray-600">{getText('uploadedResumes')}</div>
              </div>
            </div>
          </div>
        )}

        {/* Questions View - continuing with existing structure but using new API */}
        {currentView === 'questions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <h2 className="text-xl md:text-2xl font-bold">{getText('questionManagement')}</h2>
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
                    <span className="hidden sm:inline">{getText('manualAdd')}</span>
                    <span className="sm:hidden">{getText('addButton')}</span>
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm md:text-base whitespace-nowrap"
                  >
                    <FileUp className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden sm:inline">{getText('importDoc')}</span>
                    <span className="sm:hidden">{getText('import')}</span>
                  </button>
                  <button
                    onClick={openGenerateModal}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm md:text-base whitespace-nowrap"
                  >
                    {loading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />}
                    <span className="hidden sm:inline">{getText('aiGenShort')}</span>
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
                      placeholder={getText('searchPlaceholder')}
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                  <button
                    onClick={handleSearch}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    {getText('searchButton')}
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
                  {getText('allQuestions')} ({allQuestionsTotal})
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
                  HR ({hrQuestionsTotal})
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
                  Tech ({techQuestionsTotal})
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
                  <div key={question.id} className="border rounded-lg hover:border-blue-300 transition" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                    <div className="p-3 md:p-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-2">
                        <div className="flex-1 cursor-pointer" onClick={() => toggleQuestionExpand(question.id)}>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-1 text-xs rounded ${catInfo.bg} ${catInfo.text}`}>
                              {catInfo.label}
                            </span>
                            {question.is_ai_generated === 1 && (
                              <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">{getText('aiGenShort')}</span>
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
                            <span className="hidden md:inline">{getText('practiceShort')}</span>
                            <span className="md:hidden">{getText('practiceShort')}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          {question.model_answer_ja && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">{getText('modelAnswerLabel')}:</h4>
                              <div className="bg-gray-50 p-3 rounded-lg text-sm whitespace-pre-wrap text-gray-800">
                                {question.model_answer_ja}
                              </div>
                            </div>
                          )}
                          {question.tips_ja && question.tips_ja.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">{getText('answerPointsLabel')}:</h4>
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
                    {getText('noQuestions')}
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
              {editingQuestion ? getText('editQuestion') : getText('addNewQuestion')}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-2">{getText('categoryLabel')}</label>
                <select
                  value={questionForm.category}
                  onChange={(e) => setQuestionForm({...questionForm, category: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="HR">{getText('hrGeneral')}</option>
                  <option value="Tech">{getText('techTechnical')}</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-2">{getText('questionJa')}</label>
                <textarea
                  value={questionForm.question_ja}
                  onChange={(e) => setQuestionForm({...questionForm, question_ja: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-2">{getText('questionZh')}</label>
                <textarea
                  value={questionForm.question_zh}
                  onChange={(e) => setQuestionForm({...questionForm, question_zh: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={3}
                />
              </div>

              <div>
                <label className="block font-medium mb-2">{getText('modelAnswer')}</label>
                <textarea
                  value={questionForm.model_answer_ja}
                  onChange={(e) => setQuestionForm({...questionForm, model_answer_ja: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={8}
                  placeholder="【Point】...&#10;【Reason】...&#10;【Example】...&#10;【Point】..."
                />
              </div>

              <div>
                <label className="block font-medium mb-2">{getText('answerTips')}</label>
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
                <label className="block font-medium mb-2">{getText('summaryLabel')}</label>
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
                  {getText('saveButton')}
                </button>
                <button
                  onClick={() => setCurrentView('questions')}
                  className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300"
                >
                  {getText('cancelButton')}
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
                    <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">{getText('aiGenerated')}</span>
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

              <h2 className="text-2xl font-bold mb-2" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                {selectedQuestion.question_ja}
              </h2>
              {selectedQuestion.question_zh && (
                <p className="text-gray-600 mb-4" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                  {selectedQuestion.question_zh}
                </p>
              )}

              {/* Tips */}
              {selectedQuestion.tips_ja && selectedQuestion.tips_ja.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                  <h3 className="font-semibold mb-2">{getText('answerTipsTitle')}</h3>
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
                  <label className="font-medium">{getText('yourAnswer')}</label>
                  <div className="flex gap-2">
                    {!isRecording ? (
                      <button
                        onClick={handleStartRecording}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        <Mic className="w-5 h-5" />
                        {getText('voiceAnswer')}
                      </button>
                    ) : (
                      <button
                        onClick={handleStopRecording}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 animate-pulse"
                      >
                        <Mic className="w-5 h-5" />
                        {getText('recording')}
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={8}
                  placeholder={getText('answerPlaceholder')}
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
                    {getText('aiAnalyzing')}
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-5 h-5" />
                    {getText('getFeedback')}
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
                {getText('skipToNext')}
              </button>
            </div>

            {/* AI Feedback */}
            {aiFeedback && (
              <div className="bg-white rounded-lg shadow-sm p-6" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                <h3 className="text-xl font-bold mb-4">{getText('aiFeedback')}</h3>
                
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{getText('score')}</span>
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
                  <h4 className="font-semibold mb-2">{getText('overallComment')}</h4>
                  <p className="text-gray-700">{aiFeedback.feedback}</p>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold mb-2">{getText('improvementAdvice')}</h4>
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
                  <h4 className="font-semibold mb-2">{getText('revisedVersion')}</h4>
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
                    <div key={idx} className={`p-4 rounded-lg ${turn.type === 'initial' ? 'bg-blue-50' : 'bg-purple-50'}`} onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
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
                                <h5 className="font-medium text-sm text-gray-700">{getText('yourAnswerLabel')}:</h5>
                                <p className="text-gray-600 bg-white p-2 rounded">{turn.userAnswer}</p>
                              </div>
                              {turn.aiFeedback && (
                                <div className="bg-white p-3 rounded">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-semibold text-sm">{getText('score')}:</span>
                                    <span className="text-lg font-bold text-purple-600">{turn.aiFeedback.score}/100</span>
                                  </div>
                                  <p className="text-sm text-gray-700">{turn.aiFeedback.feedback}</p>
                                  {turn.aiFeedback.improvements && turn.aiFeedback.improvements.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs font-semibold text-gray-600">{getText('improvements')}:</p>
                                      <ul className="text-xs space-y-1 mt-1">
                                        {turn.aiFeedback.improvements.map((imp, i) => (
                                          <li key={i} className="text-gray-600">• {imp}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {turn.aiFeedback.correctedVersion && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <p className="text-xs font-semibold text-green-600 mb-1">✨ {getText('improvedAnswer')}:</p>
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
                  <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 mb-4" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                    <h4 className="font-semibold text-purple-700 mb-2">新しい追問:</h4>
                    <p className="text-gray-800 mb-4">{pendingFollowUp.followUpQuestion}</p>
                    
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-medium text-sm text-gray-700">{getText('yourAnswer')}</label>
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
                  <h3 className="text-xl font-bold">{getText('viewModelAnswer')}</h3>
                  <ChevronRight className={`w-6 h-6 transition-transform ${showModelAnswer ? 'rotate-90' : ''}`} />
                </button>
                
                {showModelAnswer && (
                  <div className="bg-gray-50 border rounded-lg p-4 whitespace-pre-wrap" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                    {selectedQuestion.model_answer_ja}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setCurrentView('questions')}
              className="w-full bg-gray-200 py-3 rounded-lg hover:bg-gray-300"
            >
              {getText('backToQuestionList')}
            </button>
          </div>
        )}

        {/* Favorites View */}
        {currentView === 'favorites' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">{getText('favoriteQuestions')}</h2>

            {favorites.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {getText('noFavorites')}
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
                    <div key={fav.id} className="border rounded-lg p-3 md:p-4 bg-gray-50" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
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
                          </button>
                        </div>
                      </div>

                      {/* 保存された用户回答 */}
                      {fav.user_answer && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">📝 {getText('yourAnswer')}</h4>
                          <div className="bg-white p-3 rounded border text-sm">
                            {fav.user_answer}
                          </div>
                        </div>
                      )}

                      {/* AIフィードバック */}
                      {aiFeedbackData && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">🤖 {getText('aiFeedback')}</h4>
                          <div className="bg-blue-50 p-3 rounded space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{getText('score')}:</span>
                              <span className="text-2xl font-bold text-blue-600">{aiFeedbackData.score}/100</span>
                            </div>
                            {aiFeedbackData.feedback && (
                              <div className="text-sm">
                                <span className="font-semibold">{getText('evaluation')}:</span>
                                <p className="mt-1">{aiFeedbackData.feedback}</p>
                              </div>
                            )}
                            {aiFeedbackData.advice && aiFeedbackData.advice.length > 0 && (
                              <div className="text-sm">
                                <span className="font-semibold">{getText('advice')}:</span>
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
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">✨ {getText('improvedAnswer')}</h4>
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
                                      onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}
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
                                          <p className="text-xs font-semibold text-gray-600 mb-1">{getText('yourAnswer')}:</p>
                                          <p className="text-sm text-gray-700 whitespace-pre-line bg-white p-2 rounded">
                                            {turn.userAnswer}
                                          </p>
                                        </div>
                                      )}

                                      {/* AIフィードバック */}
                                      {turn.aiFeedback && (
                                        <div>
                                          <p className="text-xs font-semibold text-gray-600 mb-1">{getText('aiEvaluation')}:</p>
                                          <div className="bg-white p-2 rounded">
                                            {turn.aiFeedback.score !== undefined && (
                                              <p className="text-sm mb-1">
                                                <span className="font-semibold">{getText('score')}:</span>{' '}
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
                                                <p className="text-xs font-semibold text-green-600">{getText('goodPoints')}:</p>
                                                <ul className="text-xs text-gray-600 list-disc list-inside">
                                                  {turn.aiFeedback.strengths.map((s, i) => (
                                                    <li key={i}>{s}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                            {turn.aiFeedback.improvements && turn.aiFeedback.improvements.length > 0 && (
                                              <div className="mt-1">
                                                <p className="text-xs font-semibold text-orange-600">{getText('improvements')}:</p>
                                                <ul className="text-xs text-gray-600 list-disc list-inside">
                                                  {turn.aiFeedback.improvements.map((s, i) => (
                                                    <li key={i}>{s}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                            {turn.aiFeedback.correctedVersion && (
                                              <div className="mt-2 pt-2 border-t border-gray-200">
                                                <p className="text-xs font-semibold text-green-600 mb-1">✨ {getText('improvedAnswer')}:</p>
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
              <h2 className="text-2xl font-bold">{getText('resumeManagement')}</h2>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                <Upload className="w-5 h-5" />
                {getText('uploadResume')}
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".txt,.pdf,.doc,.docx"
                  className="hidden"
                />
              </label>
            </div>

            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>{getText('privacyProtection')}</strong> {getText('privacyDesc')}
              </p>
              <p className="text-sm text-gray-600">
                {getText('uploadDocTypes')}
              </p>
            </div>

            {resumes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {getText('noResumesUploaded')}
              </div>
            ) : (
              <div className="space-y-4">
                {resumes.map((resume) => (
                  <div key={resume.id} className="border rounded-lg p-4" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
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
                          <h4 className="font-medium mb-1">{getText('skillsLabel')}</h4>
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
                          <h4 className="font-medium mb-1">{getText('experienceLabel')}</h4>
                          <p className="text-sm text-gray-700">{resume.experience}</p>
                        </div>
                      )}

                      {resume.education && (
                        <div>
                          <h4 className="font-medium mb-1">{getText('educationLabel')}</h4>
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
              <div>
                <h2 className="text-2xl font-bold">{getText('vocabularyPageTitle')}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {vocabularyTotal} / 1000 {getText('itemsCount')}
                  {vocabularyTotal >= 1000 && (
                    <span className="ml-2 text-orange-600 font-medium">
                      ⚠️ {currentUser?.target_language === 'ja' ? '上限到達' : '已达上限'}
                    </span>
                  )}
                  {vocabularyTotal >= 900 && vocabularyTotal < 1000 && (
                    <span className="ml-2 text-yellow-600">
                      ({currentUser?.target_language === 'ja' ? 'もうすぐ上限' : '即将达到上限'})
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {vocabularyNotes.length > 0 && (
                  <>
                    <button
                      onClick={handleExportVocabulary}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Download className="w-5 h-5" />
                      {getText('exportVocabulary')}
                    </button>
                    {!reviewMode && (
                      <button
                        onClick={startReviewMode}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <RotateCcw className="w-5 h-5" />
                        {getText('reviewMode')}
                      </button>
                    )}
                  </>
                )}
              </div>
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
                    <strong>{getText('vocabHelpTitle')}</strong> {getText('vocabHelpDesc')}
                  </p>
                </div>

                {vocabularyNotes.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {getText('noVocabulary')}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vocabularyNotes.map((note) => {
                      const isExpanded = expandedVocabIds.has(note.id);
                      const hasDetails = note.explanation || (note.example_sentences && note.example_sentences.length > 0) || (note.tags && note.tags.length > 0);
                      
                      return (
                      <div key={note.id} className="border rounded-lg p-3 md:p-4 bg-gray-50" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                        <div 
                          className={`flex items-start justify-between mb-2 ${hasDetails ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (hasDetails) {
                              const newExpanded = new Set(expandedVocabIds);
                              if (isExpanded) {
                                newExpanded.delete(note.id);
                              } else {
                                newExpanded.add(note.id);
                              }
                              setExpandedVocabIds(newExpanded);
                            }
                          }}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                        <h3 className="text-lg md:text-xl font-bold text-blue-700 mb-1 break-words">{note.word}</h3>
                        <p className="text-sm md:text-base text-gray-600 break-words">{note.translation}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditVocabulary(note);
                          }}
                          className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0"
                          title={getText('editButton')}
                        >
                          <Edit className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVocabulary(note.id);
                          }}
                          className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t">
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
                          <div className="flex flex-wrap gap-1.5 md:gap-2 mb-2">
                            {note.tags.map((tag, idx) => (
                              <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="text-xs text-gray-400">
                          {new Date(note.created_at).toLocaleString('ja-JP')}
                        </div>
                      </div>
                    )}
                  </div>
                      );
                    })}
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
                {getText('pageOf')} {currentReviewIndex + 1} / {vocabularyNotes.length}
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
            
            <div className="p-6" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
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
                    <div className="text-gray-700 markdown-content">
                      <ReactMarkdown>{vocabularyAnalysis.explanation}</ReactMarkdown>
                    </div>
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
            title={`${getText('analyzeWord')}「${selectedText}」`}
          >
            <Search className="w-4 h-4" />
            <span className="text-sm font-medium">{loading ? getText('analyzing') : getText('aiAnalyze')}</span>
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
              <label className="block font-medium mb-2">{getText('documentFile')}</label>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={(e) => setImportFile(e.target.files[0])}
                className="w-full px-4 py-2 border rounded-lg"
              />
              {importFile && (
                <p className="mt-2 text-sm text-gray-600">
                  {getText('selectedFile')}: {importFile.name}
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
                {getText('importButton')}
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
                {getText('cancelButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Analysis Modal */}
      {showAnalysisModal && analyzingQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{getText('aiQuestionAnalysis')}</h3>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700 mb-1">{getText('questionLabel')}</div>
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
                <span className="font-medium">{getText('generateStandardAnswer')}</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                {getText('generateHintsOnly')}
              </p>
            </div>

            <div className="mb-6">
              <label className="block font-medium mb-2">{getText('additionalPrompt')}</label>
              <textarea
                value={analysisPrompt}
                onChange={(e) => setAnalysisPrompt(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                rows={4}
                placeholder={getText('promptPlaceholder')}
              />
              <p className="mt-2 text-sm text-gray-600">
                {getText('promptHint')}
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-1">{getText('nonNativeSetting')}</div>
                  <div>{getText('nonNativeDesc')}</div>
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
                {getText('startAnalysis')}
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
                {getText('cancelButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Generation Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">{getText('aiQuestionGen')}</h3>
            <p className="text-gray-600 mb-4">
              {getText('selectCategory')}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block font-medium mb-2">{getText('categoryLabel')}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setGenerateCategory('HR')}
                  className={`p-3 rounded-lg border-2 transition ${
                    generateCategory === 'HR'
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-medium">{getText('hrGeneral')}</div>
                  <div className="text-xs text-gray-600 mt-1">{getText('hrDesc2')}</div>
                </button>
                <button
                  onClick={() => setGenerateCategory('Tech')}
                  className={`p-3 rounded-lg border-2 transition ${
                    generateCategory === 'Tech'
                      ? 'border-green-600 bg-green-50 text-green-600'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="font-medium">{getText('techTechnical')}</div>
                  <div className="text-xs text-gray-600 mt-1">{getText('techDesc2')}</div>
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block font-medium mb-2">{getText('generateCount')}</label>
              <select
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value={1}>1{getText('countUnit')}</option>
                <option value={2}>2{getText('countUnit')}</option>
                <option value={3}>3{getText('countUnit')}</option>
                <option value={5}>5{getText('countUnit')}</option>
              </select>
            </div>

            {resumes.length > 0 && (
              <div className="mb-6 p-3 bg-green-50 rounded-lg text-sm text-green-800">
                ✓ {getText('resumePersonalized')}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleGenerateQuestions(generateCategory, generateCount)}
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                {getText('startGenerate')}
              </button>
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setError('');
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                {getText('cancelButton')}
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('displayLanguage')}
                    </label>
                    <select
                      value={settingsForm.target_language || currentUser.target_language || 'ja'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, target_language: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg bg-white"
                    >
                      <option value="ja">🇯🇵 日本語 (Japanese)</option>
                      <option value="zh">🇨🇳 中文 (Chinese)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {getText('selectDisplayLang')}
                    </p>
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
                        title={showApiKey ? getText('hide') : getText('showHide')}
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
                        💡 {getText('keepExistingChange')}
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
                      {getText('notionDbUrl')}
                    </p>
                    {currentUser.notion_configured && (
                      <p className="text-xs text-gray-500 mt-1">
                        💡 {getText('keepExisting')}
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>💡 {getText('notionHint')}:</strong>
                      <br />• {getText('notionColumns')}
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
                {getText('saveSettings')}
              </button>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setError('');
                }}
                disabled={loading}
                className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                {getText('cancelButton')}
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
                {getText('aiCreditsManagement')}
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
                    <p className="text-yellow-100 mb-1">{getText('currentBalance')}</p>
                    <p className="text-4xl font-bold">{aiCredits} {getText('points')}</p>
                  </div>
                  <button
                    onClick={() => setShowRechargeModal(true)}
                    className="bg-white text-yellow-600 px-6 py-3 rounded-lg hover:bg-yellow-50 transition flex items-center gap-2 font-semibold"
                  >
                    <CreditCard className="w-5 h-5" />
                    {getText('recharge')}
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
                            {cost.operation === 'ANALYZE_WORD' && '専門用語を生成'}
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
                      {getText('noUsageHistory')}
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
                {getText('closeButton')}
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
                {getText('pointRecharge')}
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
                {getText('cancelButton')}
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
              <h2 className="text-2xl font-bold mb-4">{getText('editWord')}</h2>
              
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
                  <label className="block font-medium mb-2">{getText('explanationLabel')}</label>
                  <textarea
                    value={vocabularyForm.explanation}
                    onChange={(e) => setVocabularyForm({ ...vocabularyForm, explanation: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 h-32"
                    placeholder={getText('markdownPlaceholder')}
                  />
                  {vocabularyForm.explanation && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">{getText('preview')}</p>
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
                  {getText('saveSettings')}
                </button>
                <button
                  onClick={() => {
                    setShowVocabEditModal(false);
                    setEditingVocabulary(null);
                  }}
                  className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300"
                >
                  {getText('cancelButton')}
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

      {/* Onboarding Guide Modal */}
      {showOnboardingGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">{getText('onboardingTitle')}</h2>
            <div className="text-gray-700 whitespace-pre-line mb-6 leading-relaxed">
              {getText('onboardingMessage')}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOnboardingGuide(false);
                  setCurrentView('questions');
                }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
              >
                📝 {currentUser?.target_language === 'zh' ? '去生成问题' : '質問を生成する'}
              </button>
              <button
                onClick={() => setShowOnboardingGuide(false)}
                className="px-6 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 font-semibold"
              >
                {getText('gotIt')}
              </button>
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
      
      {/* PREP Practice Modal */}
      {showPrepPractice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{getText('prepPracticeTitle')}</h2>
                <button
                  onClick={() => setShowPrepPractice(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Example Step */}
              {prepStep === 'example' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">{getText('prepExampleTitle')}</h3>
                    <div className="mb-4">
                      <p className="font-semibold text-lg mb-2">
                        {currentUser?.target_language === 'ja' 
                          ? 'あなたは家で映画を見るのと映画館で見るのとどちらが好きですか？' 
                          : '你喜欢在家看电影还是在电影院看电影？'}
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 space-y-3">
                      <div className="border-l-4 border-blue-500 pl-4">
                        <p className="font-semibold text-blue-700">Point（结论）</p>
                        <p className="text-gray-700">
                          {currentUser?.target_language === 'ja'
                            ? '私は家で映画を見る方が好きです。'
                            : '我更喜欢在家看电影。'}
                        </p>
                      </div>
                      
                      <div className="border-l-4 border-green-500 pl-4">
                        <p className="font-semibold text-green-700">Reason（理由）</p>
                        <p className="text-gray-700">
                          {currentUser?.target_language === 'ja'
                            ? 'なぜなら、自分のペースでリラックスして楽しめるからです。'
                            : '因为可以按照自己的节奏放松地享受。'}
                        </p>
                      </div>
                      
                      <div className="border-l-4 border-purple-500 pl-4">
                        <p className="font-semibold text-purple-700">Example（例子）</p>
                        <p className="text-gray-700">
                          {currentUser?.target_language === 'ja'
                            ? '例えば、好きな食べ物を用意したり、途中で一時停止して休憩したりできます。また、映画館のように他の人に気を使う必要もありません。'
                            : '例如，可以准备喜欢的食物，中途暂停休息。而且不用像电影院那样顾虑其他人。'}
                        </p>
                      </div>
                      
                      <div className="border-l-4 border-blue-500 pl-4">
                        <p className="font-semibold text-blue-700">Point（总结）</p>
                        <p className="text-gray-700">
                          {currentUser?.target_language === 'ja'
                            ? 'ですから、私は家で映画を見る方が好きです。'
                            : '所以，我更喜欢在家看电影。'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handlePrepStartPractice}
                    disabled={prepLoading}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                  >
                    {prepLoading ? getText('loading') : getText('prepStartPractice')}
                  </button>
                </div>
              )}

              {/* Practice Step */}
              {prepStep === 'practice' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3">
                      {currentUser?.target_language === 'ja' ? '質問' : '问题'}
                    </h3>
                    <p className="text-xl text-gray-800">{prepQuestion}</p>
                  </div>
                  
                  <div>
                    <label className="block font-semibold mb-2">{getText('prepYourAnswer')}</label>
                    <p className="text-sm text-gray-500 mb-3">
                      {currentUser?.target_language === 'ja' 
                        ? '💡 任意の言語で入力できます（日本語、中国語、英語など）'
                        : '💡 可以使用任何语言输入（日语、中文、英语等）'}
                    </p>
                    <textarea
                      value={prepAnswer}
                      onChange={(e) => setPrepAnswer(e.target.value)}
                      placeholder={getText('prepAnswerPlaceholder')}
                      className="w-full border rounded-lg p-4 min-h-[200px]"
                    />
                  </div>
                  
                  <button
                    onClick={handlePrepSubmitAnswer}
                    disabled={!prepAnswer.trim() || prepLoading}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                  >
                    {prepLoading ? getText('prepAnalyzing') : getText('prepSubmitAnswer')}
                  </button>
                </div>
              )}

              {/* Analysis Step */}
              {prepStep === 'analysis' && prepAnalysis && (
                <div className="space-y-6">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">{getText('prepAnalysisTitle')}</h3>
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: marked.parse(prepAnalysis.analysis || '') }}
                    />
                  </div>
                  
                  {prepAnalysis.modelAnswer && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">
                        {currentUser?.target_language === 'ja' ? '標準答案' : '标准答案'}
                      </h3>
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: marked.parse(prepAnalysis.modelAnswer || '') }}
                      />
                    </div>
                  )}
                  
                  <button
                    onClick={handlePrepNextQuestion}
                    disabled={prepLoading}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                  >
                    {prepLoading ? getText('loading') : getText('prepNextQuestion')}
                  </button>
                </div>
              )}
            </div>
          </div>
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

