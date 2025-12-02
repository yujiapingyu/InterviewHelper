import { useState, useEffect } from 'react';
import { Users, CreditCard, BarChart3, Download, RefreshCw, Search, Plus, Key, Shield, Info, X } from 'lucide-react';

function AdminPanel({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('cards');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Card management state
  const [cards, setCards] = useState([]);
  const [cardStats, setCardStats] = useState(null);
  const [generateForm, setGenerateForm] = useState({
    count: 10,
    credits: 100,
    expiry_days: null
  });
  const [selectedCardUser, setSelectedCardUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  
  // User management state
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://japanesetalk.org/api';
  
  const fetchCards = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/cards?limit=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch cards');
      
      const data = await response.json();
      setCards(data.cards);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCardStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/cards/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setCardStats(data.stats);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleGenerateCards = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/cards/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(generateForm)
      });
      
      if (!response.ok) throw new Error('Failed to generate cards');
      
      const data = await response.json();
      
      // Download CSV
      const csv = 'card_code,credits,expires_at\n' + 
        data.cards.map(c => `${c.card_code},${c.credits},${c.expires_at || ''}`).join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cards_${Date.now()}.csv`;
      a.click();
      
      alert(`成功生成 ${data.count} 张点卡`);
      await fetchCards();
      await fetchCardStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/admin/users?page=${usersPage}&limit=50&search=${usersSearch}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const data = await response.json();
      setUsers(data.users);
      setUsersTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCardUser = async (userId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/activity`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch user info');
      
      const data = await response.json();
      
      // Also get basic user info
      const userResponse = await fetch(`${API_BASE_URL}/admin/users?search=`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        const userInfo = userData.users.find(u => u.id === userId);
        setSelectedCardUser({
          ...userInfo,
          activity: data.history
        });
        setShowUserModal(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateCredits = async (userId, amount, reason) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ amount, reason })
      });
      
      if (!response.ok) throw new Error('Failed to update credits');
      
      alert('积分更新成功');
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleUpdateRole = async (userId, role) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ role })
      });
      
      if (!response.ok) throw new Error('Failed to update role');
      
      alert('角色更新成功');
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };
  
  useEffect(() => {
    if (activeTab === 'cards') {
      fetchCards();
      fetchCardStats();
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, usersPage, usersSearch]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-yellow-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">管理员控制台</h1>
                <p className="text-sm text-gray-500">欢迎回来，{user.email}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('cards')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                  activeTab === 'cards'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-5 h-5 inline mr-2" />
                点卡管理
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                  activeTab === 'users'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-5 h-5 inline mr-2" />
                用户管理
              </button>
            </nav>
          </div>
          
          <div className="p-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            
            {/* Card Management Tab */}
            {activeTab === 'cards' && (
              <div className="space-y-6">
                {/* Stats */}
                {cardStats && (
                  <div className="grid grid-cols-3 gap-4">
                    {cardStats.map((stat) => (
                      <div key={stat.status} className="bg-gray-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">
                          {stat.status === 'unused' ? '未使用' : stat.status === 'used' ? '已使用' : '已过期'}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{stat.count}</div>
                        <div className="text-xs text-gray-500">{stat.total_credits} 积分</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Generate Form */}
                <form onSubmit={handleGenerateCards} className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    生成新点卡
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        生成数量
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={generateForm.count}
                        onChange={(e) => setGenerateForm({...generateForm, count: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        点卡面值
                      </label>
                      <select
                        value={generateForm.credits}
                        onChange={(e) => setGenerateForm({...generateForm, credits: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required
                      >
                        <option value={100}>100 积分</option>
                        <option value={300}>300 积分</option>
                        <option value={500}>500 积分</option>
                        <option value={1000}>1000 积分</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        有效期（天）
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="不限制"
                        value={generateForm.expiry_days || ''}
                        onChange={(e) => setGenerateForm({...generateForm, expiry_days: e.target.value ? parseInt(e.target.value) : null})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-4 px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                  >
                    {loading ? '生成中...' : '生成并导出'}
                  </button>
                </form>
                
                {/* Cards List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">点卡列表</h3>
                    <button
                      onClick={fetchCards}
                      className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      刷新
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">点卡码</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">面值</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">状态</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">创建时间</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">使用时间</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">使用用户</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {cards.map((card) => (
                          <tr key={card.id}>
                            <td className="px-4 py-3 text-sm font-mono text-gray-900">{card.card_code}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{card.credits}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                card.status === 'unused' ? 'bg-green-100 text-green-800' :
                                card.status === 'used' ? 'bg-gray-100 text-gray-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {card.status === 'unused' ? '未使用' : card.status === 'used' ? '已使用' : '已过期'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(card.created_at).toLocaleString('zh-CN')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {card.used_at ? new Date(card.used_at).toLocaleString('zh-CN') : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {card.used_by ? (
                                <button
                                  onClick={() => fetchCardUser(card.used_by)}
                                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition"
                                >
                                  <Info className="w-4 h-4" />
                                  查看
                                </button>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            
            {/* User Management Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                {/* Search */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索用户邮箱或用户名..."
                      value={usersSearch}
                      onChange={(e) => setUsersSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <button
                    onClick={fetchUsers}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    刷新
                  </button>
                </div>
                
                {/* Users List */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">邮箱</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">用户名</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">角色</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">积分</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">注册时间</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.username || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="user">用户</option>
                              <option value="admin">管理员</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.ai_credits}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(u.created_at).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => {
                                const amount = prompt('输入积分变化量（正数增加，负数减少）:');
                                const reason = prompt('输入操作原因:');
                                if (amount && reason) {
                                  handleUpdateCredits(u.id, parseInt(amount), reason);
                                }
                              }}
                              className="text-yellow-600 hover:text-yellow-700"
                            >
                              调整积分
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    共 {usersTotal} 个用户
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                      disabled={usersPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                    >
                      上一页
                    </button>
                    <span className="text-sm text-gray-600">第 {usersPage} 页</span>
                    <button
                      onClick={() => setUsersPage(p => p + 1)}
                      disabled={usersPage * 50 >= usersTotal}
                      className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* User Info Modal */}
      {showUserModal && selectedCardUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5" />
                用户信息
              </h2>
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setSelectedCardUser(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">基本信息</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">用户ID:</span>
                    <span className="ml-2 font-medium">{selectedCardUser.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">邮箱:</span>
                    <span className="ml-2 font-medium">{selectedCardUser.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">用户名:</span>
                    <span className="ml-2 font-medium">{selectedCardUser.username || '未设置'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">当前积分:</span>
                    <span className="ml-2 font-medium text-yellow-600">{selectedCardUser.ai_credits}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">角色:</span>
                    <span className="ml-2 font-medium">{selectedCardUser.role === 'admin' ? '管理员' : '普通用户'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">注册时间:</span>
                    <span className="ml-2 font-medium">{new Date(selectedCardUser.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              </div>
              
              {/* Activity History */}
              {selectedCardUser.activity && selectedCardUser.activity.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">最近活动记录</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">类型</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">积分变化</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">说明</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">时间</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedCardUser.activity.slice(0, 10).map((activity) => (
                          <tr key={activity.id}>
                            <td className="px-3 py-2 text-sm text-gray-900">{activity.change_type}</td>
                            <td className="px-3 py-2 text-sm">
                              <span className={activity.credits_change > 0 ? 'text-green-600' : 'text-red-600'}>
                                {activity.credits_change > 0 ? '+' : ''}{activity.credits_change}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600">{activity.description}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {new Date(activity.created_at).toLocaleString('zh-CN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
