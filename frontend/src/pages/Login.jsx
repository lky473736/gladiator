import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import '../styles/Auth.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      const errorMessage = err.response?.data?.detail || '로그인에 실패했습니다';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page page-fade-in">
      <div className="auth-left">
        {(() => {
          const emojis = ['⚔️', '🏟️', '🛡️', '👑', '💪', '🎯', '🏆', '⚡', '🔥', '🗡️'];
          const positions = [
            { top: 10, left: 15, size: 120 },
            { top: 55, left: 70, size: 110 },
            { top: 75, left: 20, size: 100 },
            { top: 25, left: 60, size: 65 },
            { top: 40, left: 40, size: 70 },
            { top: 15, left: 80, size: 60 },
            { top: 85, left: 55, size: 75 },
            { top: 50, left: 10, size: 65 },
            { top: 30, left: 85, size: 70 },
            { top: 65, left: 45, size: 60 }
          ];

          return positions.map((pos, i) => (
            <div
              key={i}
              className="floating-emoji"
              style={{
                top: `${pos.top}%`,
                left: `${pos.left}%`,
                fontSize: `${pos.size}px`
              }}
            >
              {emojis[i % emojis.length]}
            </div>
          ));
        })()}
        <div className="auth-left-content">
          <h1 className="auth-title">Gladiator</h1>
          <p className="auth-subtitle">온라인 코딩 저지 플랫폼</p>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-container slide-in-right">
          <h2>로그인</h2>
          <p className="auth-description">코딩 문제를 풀어보세요</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>아이디</label>
              <input
                type="text"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary full-width"
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              계정이 없으신가요? <Link to="/register" className="auth-link">회원가입</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
