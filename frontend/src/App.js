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

  const ScheduleCard = ({ schedule }) => {
    const formatDate = (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('pt-BR');
    };

    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mb-4 border-l-4 border-blue-500">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{formatDate(schedule.date)}</h3>
            <p className="text-blue-600 font-medium">{getDayTypeLabel(schedule.day_type)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {schedule.assignments.map((assignment, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-800">{getFunctionLabel(assignment.function_type)}</h4>
                <span className="text-sm text-gray-500">{assignment.user_ids.length} pessoa(s)</span>
              </div>
              
              <div className="space-y-2">
                {assignment.user_ids.map((userId) => {
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
                })}
              </div>
            </div>
          ))}
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

// Main App Component
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