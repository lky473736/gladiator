import { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import '../styles/Modal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function LoginModal({ onClose, onSwitchToRegister }) {
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // OAuth2PasswordRequestForm 형식으로 전송
      const formBody = new URLSearchParams();
      formBody.append('username', formData.username);
      formBody.append('password', formData.password);

      const response = await axios.post(`${API_URL}/api/auth/login`, formBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // 토큰 저장
      const token = response.data.access_token;
      localStorage.setItem('token', token);

      // 모달 닫고 새로고침
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('로그인 에러:', error);
      let errorMessage = '로그인에 실패했습니다';

      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map(e => e.msg || e).join(', ');
        } else {
          errorMessage = JSON.stringify(error.response.data.detail);
        }
      }

      setError(errorMessage);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>로그인</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>사용자명</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn-submit">로그인</button>

          <div className="modal-footer">
            <p>
              계정이 없으신가요?{' '}
              <button type="button" className="link-btn" onClick={onSwitchToRegister}>
                회원가입
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
