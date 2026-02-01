import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
axios.defaults.baseURL = API_URL;

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await axios.post('/api/auth/login', formData);
    const { access_token } = response.data;

    localStorage.setItem('token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

    await fetchUser();
  };

  const register = async (userData) => {
    try {
      console.log('🔵 회원가입 요청:', userData);

      // 회원가입
      const registerResponse = await axios.post('/api/auth/register', userData);
      console.log('✅ 회원가입 성공:', registerResponse.data);

      // 자동 로그인
      const formData = new FormData();
      formData.append('username', userData.username);
      formData.append('password', userData.password);

      const loginResponse = await axios.post('/api/auth/login', formData);
      const { access_token } = loginResponse.data;

      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      console.log('🔵 자동 로그인 완료');

      await fetchUser();
      return registerResponse.data;
    } catch (error) {
      console.error('❌ 회원가입/로그인 실패:', error);
      console.error('   에러 응답:', error.response?.data);

      // Pydantic validation error 파싱
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;

        if (Array.isArray(detail)) {
          // Pydantic validation error (배열 형태)
          const messages = detail.map(err => {
            const field = err.loc ? err.loc[err.loc.length - 1] : 'unknown';
            const msg = err.msg || err.message || '검증 오류';
            return `${field}: ${msg}`;
          });
          throw new Error(messages.join('\n'));
        } else if (typeof detail === 'string') {
          // 일반 에러 메시지
          throw new Error(detail);
        }
      }

      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
