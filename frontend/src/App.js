import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserInfo();
    }
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get(`${API}/me`);
      setUser(response.data);
    } catch (error) {
      logout();
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/login`, { username, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.detail || 'Erro no login' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// Login Component
const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(username, password);
    if (!result.success) {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-black flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-blue-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">GE</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sistema de Escala</h1>
          <p className="text-gray-600">Geração Eleita</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Digite seu usuário"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Digite sua senha"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Para administradores: use suas credenciais especiais</p>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const { user, logout, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('schedules');
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchNotifications();
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchSchedules = async () => {
    try {
      const response = await axios.get(`${API}/schedules`);
      setSchedules(response.data);
    } catch (error) {
      console.error('Erro ao buscar escalas:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications`);
      setNotifications(response.data);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    }
  };

  const handleScheduleResponse = async (scheduleId, functionType, status, reason = '') => {
    try {
      await axios.post(`${API}/schedule-response`, {
        schedule_id: scheduleId,
        function_type: functionType,
        status,
        reason
      });
      alert('Resposta registrada com sucesso!');
      fetchSchedules();
    } catch (error) {
      alert('Erro ao registrar resposta: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const getDayTypeLabel = (dayType) => {
    const labels = {
      'wednesday': 'Quarta-feira',
      'friday': 'Sexta-feira',
      'saturday': 'Sábado'
    };
    return labels[dayType] || dayType;
  };

  const getFunctionLabel = (functionType) => {
    const labels = {
      'portaria': 'Portaria',
      'limpeza': 'Limpeza',
      'pregacao': 'Pregação',
      'louvor': 'Louvor',
      'introdutoria': 'Introdutória'
    };
    return labels[functionType] || functionType;
  };

  const getRequiredCount = (functionType, dayType) => {
    if (functionType === 'pregacao' || functionType === 'introdutoria' || functionType === 'portaria') {
      return 1;
    }
    if (functionType === 'limpeza' || functionType === 'louvor') {
      return 3;
    }
    return 1;
  };

  const ScheduleCard = ({ schedule }) => {
    const formatDate = (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('pt-BR');
    };

    // Função para mostrar TODAS as funções, mesmo as que não têm pessoas atribuídas
    const getAllFunctions = (dayType) => {
      if (dayType === 'wednesday' || dayType === 'saturday') {
        return ['pregacao', 'limpeza', 'louvor', 'introdutoria'];
      } else if (dayType === 'friday') {
        return ['pregacao', 'portaria'];
      }
      return [];
    };

    const allFunctions = getAllFunctions(schedule.day_type);

    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mb-4 border-l-4 border-blue-500">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{formatDate(schedule.date)}</h3>
            <p className="text-blue-600 font-medium">{getDayTypeLabel(schedule.day_type)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {allFunctions.map((functionType) => {
            const assignment = schedule.assignments.find(a => a.function_type === functionType);
            const requiredCount = getRequiredCount(functionType, schedule.day_type);
            
            return (
              <div key={functionType} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-gray-800">{getFunctionLabel(functionType)}</h4>
                  <span className="text-sm text-gray-500">
                    {assignment ? assignment.user_ids.length : 0}/{requiredCount} pessoa(s)
                  </span>
                </div>
                
                <div className="space-y-2">
                  {assignment && assignment.user_ids.length > 0 ? (
                    assignment.user_ids.map((userId) => {
                      const assignedUser = users.find(u => u.id === userId);
                      const response = assignment.responses?.[userId];
                      const isCurrentUser = userId === user.id;
                      
                      return (
                        <div key={userId} className={`flex justify-between items-center p-2 rounded ${isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'bg-white'}`}>
                          <span className={`font-medium ${isCurrentUser ? 'text-blue-800' : 'text-gray-700'}`}>
                            {assignedUser?.name || 'Usuário não encontrado'}
                            {isCurrentUser && ' (Você)'}
                          </span>
                          
                          {response && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              response.status === 'accepted' ? 'bg-green-100 text-green-800' :
                              response.status === 'declined' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {response.status === 'accepted' ? 'Confirmado' :
                               response.status === 'declined' ? 'Recusado' : 'Pendente'}
                            </span>
                          )}
                          
                          {isCurrentUser && !response && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleScheduleResponse(schedule.id, assignment.function_type, 'accepted')}
                                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                              >
                                Aceitar
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Motivo da recusa (opcional):');
                                  handleScheduleResponse(schedule.id, assignment.function_type, 'declined', reason || '');
                                }}
                                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                              >
                                Recusar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-2 text-center text-gray-500 italic">
                      Nenhuma pessoa atribuída ainda
                    </div>
                  )}
                  
                  {/* Mostrar slots vazios se necessário */}
                  {assignment && assignment.user_ids.length < requiredCount && (
                    Array.from({ length: requiredCount - assignment.user_ids.length }, (_, index) => (
                      <div key={`empty-${index}`} className="p-2 text-center text-gray-400 italic border-2 border-dashed border-gray-200 rounded">
                        Vaga disponível
                      </div>
                    ))
                  )}
                  
                  {/* Se não há assignment mas é necessário, mostrar todas as vagas */}
                  {!assignment && (
                    Array.from({ length: requiredCount }, (_, index) => (
                      <div key={`empty-${index}`} className="p-2 text-center text-gray-400 italic border-2 border-dashed border-gray-200 rounded">
                        Vaga disponível
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-bold">GE</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Sistema de Escala</h1>
                <p className="text-blue-200 text-sm">Geração Eleita</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-medium">{user?.name}</p>
                <p className="text-blue-200 text-sm">{isAdmin ? 'Administrador' : 'Usuário'}</p>
              </div>
              <button
                onClick={logout}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-all duration-200"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('schedules')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'schedules'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Escalas
            </button>
            
            <button
              onClick={() => setActiveTab('notifications')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'notifications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Notificações
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-1 text-xs">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'admin'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Administração
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'schedules' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Escalas</h2>
            {schedules.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Nenhuma escala encontrada</p>
              </div>
            ) : (
              <div className="space-y-6">
                {schedules.map((schedule) => (
                  <ScheduleCard key={schedule.id} schedule={schedule} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Notificações</h2>
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                      notification.read ? 'border-gray-300' : 'border-blue-500'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className={`${notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                          {notification.message}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={async () => {
                            await axios.patch(`${API}/notifications/${notification.id}/read`);
                            fetchNotifications();
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
};

// Admin Panel Component
const AdminPanel = () => {
  const [activeAdminTab, setActiveAdminTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  // User form states
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'user'
  });

  // Schedule form states
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    date: '',
    day_type: 'wednesday',
    assignments: []
  });

  useEffect(() => {
    fetchUsers();
    fetchSchedules();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await axios.get(`${API}/schedules`);
      setSchedules(response.data);
    } catch (error) {
      console.error('Erro ao buscar escalas:', error);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/users`, userForm);
      alert('Usuário criado com sucesso!');
      setUserForm({ username: '', name: '', email: '', password: '', role: 'user' });
      setShowUserForm(false);
      fetchUsers();
    } catch (error) {
      alert('Erro ao criar usuário: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
    
    setLoading(false);
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        await axios.delete(`${API}/users/${userId}`);
        alert('Usuário excluído com sucesso!');
        fetchUsers();
      } catch (error) {
        alert('Erro ao excluir usuário: ' + (error.response?.data?.detail || 'Erro desconhecido'));
      }
    }
  };

  const initializeScheduleAssignments = (dayType) => {
    const assignments = [];
    
    if (dayType === 'wednesday' || dayType === 'saturday') {
      assignments.push(
        { function_type: 'pregacao', user_ids: [], responses: {} },
        { function_type: 'limpeza', user_ids: [], responses: {} },
        { function_type: 'louvor', user_ids: [], responses: {} },
        { function_type: 'introdutoria', user_ids: [], responses: {} }
      );
    } else if (dayType === 'friday') {
      assignments.push(
        { function_type: 'pregacao', user_ids: [], responses: {} },
        { function_type: 'portaria', user_ids: [], responses: {} }
      );
    }
    
    return assignments;
  };

  const handleDayTypeChange = (dayType) => {
    setScheduleForm({
      ...scheduleForm,
      day_type: dayType,
      assignments: initializeScheduleAssignments(dayType)
    });
  };

  const handleAssignmentChange = (assignmentIndex, userIds) => {
    const newAssignments = [...scheduleForm.assignments];
    newAssignments[assignmentIndex].user_ids = userIds;
    setScheduleForm({ ...scheduleForm, assignments: newAssignments });
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingSchedule) {
        await axios.put(`${API}/schedules/${editingSchedule.id}`, scheduleForm);
        alert('Escala atualizada com sucesso!');
      } else {
        await axios.post(`${API}/schedules`, scheduleForm);
        alert('Escala criada com sucesso!');
      }
      setScheduleForm({ date: '', day_type: 'wednesday', assignments: [] });
      setShowScheduleForm(false);
      setEditingSchedule(null);
      fetchSchedules();
    } catch (error) {
      alert('Erro ao salvar escala: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
    
    setLoading(false);
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      date: schedule.date,
      day_type: schedule.day_type,
      assignments: schedule.assignments
    });
    setShowScheduleForm(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (window.confirm('Tem certeza que deseja excluir esta escala?')) {
      try {
        await axios.delete(`${API}/schedules/${scheduleId}`);
        alert('Escala excluída com sucesso!');
        fetchSchedules();
      } catch (error) {
        alert('Erro ao excluir escala: ' + (error.response?.data?.detail || 'Erro desconhecido'));
      }
    }
  };

  const getDayTypeLabel = (dayType) => {
    const labels = {
      'wednesday': 'Quarta-feira',
      'friday': 'Sexta-feira',
      'saturday': 'Sábado'
    };
    return labels[dayType] || dayType;
  };

  const getFunctionLabel = (functionType) => {
    const labels = {
      'portaria': 'Portaria',
      'limpeza': 'Limpeza',
      'pregacao': 'Pregação',
      'louvor': 'Louvor',
      'introdutoria': 'Introdutória'
    };
    return labels[functionType] || functionType;
  };

  const getRequiredCount = (functionType, dayType) => {
    if (functionType === 'pregacao' || functionType === 'introdutoria' || functionType === 'portaria') {
      return 1;
    }
    if (functionType === 'limpeza' || functionType === 'louvor') {
      return 3;
    }
    return 1;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Administração</h2>
      
      {/* Admin Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveAdminTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeAdminTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Gerenciar Usuários
            </button>
            <button
              onClick={() => setActiveAdminTab('schedules')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeAdminTab === 'schedules'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Gerenciar Escalas
            </button>
          </nav>
        </div>
      </div>

      {/* Users Management */}
      {activeAdminTab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Usuários</h3>
            <button
              onClick={() => setShowUserForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Novo Usuário
            </button>
          </div>

          {/* User Form Modal */}
          {showUserForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h4 className="text-lg font-bold mb-4">Criar Novo Usuário</h4>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Usuário</label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowUserForm(false)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Criando...' : 'Criar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Users List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Usuário'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {user.username !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedules Management */}
      {activeAdminTab === 'schedules' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Escalas</h3>
            <button
              onClick={() => {
                setScheduleForm({ date: '', day_type: 'wednesday', assignments: initializeScheduleAssignments('wednesday') });
                setEditingSchedule(null);
                setShowScheduleForm(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Nova Escala
            </button>
          </div>

          {/* Schedule Form Modal */}
          {showScheduleForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
                <h4 className="text-lg font-bold mb-4">{editingSchedule ? 'Editar Escala' : 'Criar Nova Escala'}</h4>
                <form onSubmit={handleCreateSchedule} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                      <input
                        type="date"
                        value={scheduleForm.date}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Culto</label>
                      <select
                        value={scheduleForm.day_type}
                        onChange={(e) => handleDayTypeChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="wednesday">Quarta-feira</option>
                        <option value="friday">Sexta-feira</option>
                        <option value="saturday">Sábado</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-md font-medium text-gray-900 mb-3">Atribuições</h5>
                    <div className="space-y-4">
                      {scheduleForm.assignments.map((assignment, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <h6 className="font-medium text-gray-800">{getFunctionLabel(assignment.function_type)}</h6>
                            <span className="text-sm text-gray-500">
                              Necessário: {getRequiredCount(assignment.function_type, scheduleForm.day_type)} pessoa(s)
                            </span>
                          </div>
                          <select
                            multiple
                            value={assignment.user_ids}
                            onChange={(e) => {
                              const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
                              handleAssignmentChange(index, selectedValues);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            size="6"
                          >
                            {users.filter(u => u.role === 'user').map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                          <div className="mt-2">
                            <p className="text-xs text-gray-500">
                              Selecionados: {assignment.user_ids.length}/{getRequiredCount(assignment.function_type, scheduleForm.day_type)} pessoa(s)
                            </p>
                            <p className="text-xs text-gray-400">
                              Ctrl+Click para selecionar múltiplos ou segure Shift para selecionar intervalo
                            </p>
                            {assignment.user_ids.length > getRequiredCount(assignment.function_type, scheduleForm.day_type) && (
                              <p className="text-xs text-red-500 mt-1">
                                ⚠️ Você selecionou mais pessoas do que o necessário!
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowScheduleForm(false);
                        setEditingSchedule(null);
                      }}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Salvando...' : (editingSchedule ? 'Atualizar Escala' : 'Criar Escala')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Schedules List */}
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">
                        {new Date(schedule.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </h4>
                      <p className="text-blue-600 font-medium">{getDayTypeLabel(schedule.day_type)}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditSchedule(schedule)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schedule.assignments.map((assignment, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <h5 className="font-medium text-gray-800 mb-2">{getFunctionLabel(assignment.function_type)}</h5>
                      <div className="space-y-1">
                        {assignment.user_ids.map((userId) => {
                          const user = users.find(u => u.id === userId);
                          const response = assignment.responses?.[userId];
                          return (
                            <div key={userId} className="flex justify-between items-center text-sm">
                              <span>{user?.name || 'Usuário não encontrado'}</span>
                              {response && (
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  response.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                  response.status === 'declined' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {response.status === 'accepted' ? 'Confirmado' :
                                   response.status === 'declined' ? 'Recusou' : 'Pendente'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const AppContent = () => {
  const { user } = useAuth();
  
  return (
    <div className="App">
      {user ? <Dashboard /> : <LoginScreen />}
    </div>
  );
};

export default App;