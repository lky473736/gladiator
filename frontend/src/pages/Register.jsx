import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import '../styles/Auth.css';

function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    bio: '',
    profile_image_url: '',
    profile_background_url: '',
    favorite_algorithms: [],
    external_link_1: '',
    external_link_2: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const algorithmTypes = [
    '동적 프로그래밍', '그리디', '그래프', 'BFS', 'DFS',
    '이진 탐색', '분할 정복', '백트래킹', '문자열',
    '트리', '정렬', '해시', '스택', '큐', '우선순위 큐',
    '투 포인터', '슬라이딩 윈도우', '비트마스킹', '수학',
    '기하학', '구현', '시뮬레이션', '완전 탐색', '최단 경로',
    '최소 신장 트리', '위상 정렬', '강한 연결 요소',
    '유니온 파인드', '세그먼트 트리', 'LCA'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAlgorithmToggle = (algo) => {
    const current = formData.favorite_algorithms;
    if (current.includes(algo)) {
      setFormData({
        ...formData,
        favorite_algorithms: current.filter(a => a !== algo)
      });
    } else if (current.length < 3) {
      setFormData({
        ...formData,
        favorite_algorithms: [...current, algo]
      });
    }
  };

  const validateStep1 = () => {
    // 필수 필드 검증
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      alert('모든 필수 필드를 입력해주세요');
      return false;
    }

    // 아이디 검증
    if (formData.username.length < 3) {
      alert('아이디는 3자 이상이어야 합니다');
      return false;
    }
    if (formData.username.length > 20) {
      alert('아이디는 20자 이하여야 합니다');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      alert('아이디는 영문, 숫자, 언더스코어(_)만 사용 가능합니다');
      return false;
    }
    if (/^\d/.test(formData.username)) {
      alert('아이디는 숫자로 시작할 수 없습니다');
      return false;
    }

    // 이메일 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('올바른 이메일 형식이 아닙니다');
      return false;
    }

    // 비밀번호 검증
    if (formData.password.length < 8) {
      alert('비밀번호는 8자 이상이어야 합니다');
      return false;
    }
    if (formData.password.length > 50) {
      alert('비밀번호는 50자 이하여야 합니다');
      return false;
    }
    if (!/[A-Za-z]/.test(formData.password)) {
      alert('비밀번호는 영문을 포함해야 합니다');
      return false;
    }
    if (!/\d/.test(formData.password)) {
      alert('비밀번호는 숫자를 포함해야 합니다');
      return false;
    }
    const weakPasswords = ['password', '12345678', 'qwerty123', 'password123'];
    if (weakPasswords.includes(formData.password.toLowerCase())) {
      alert('너무 단순한 비밀번호입니다');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      alert('비밀번호가 일치하지 않습니다');
      return false;
    }

    // 닉네임 검증 (선택 사항이지만 입력했다면 검증)
    if (formData.nickname && formData.nickname.length > 30) {
      alert('닉네임은 30자 이하여야 합니다');
      return false;
    }
    if (formData.nickname && formData.nickname.trim().length === 0) {
      alert('닉네임은 공백만으로 구성될 수 없습니다');
      return false;
    }

    // 자기소개 검증
    if (formData.bio && formData.bio.length > 500) {
      alert('자기소개는 500자 이하여야 합니다');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    setError('');
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('📝 회원가입 데이터 준비 중...');
      const { confirmPassword, ...registerData } = formData;

      console.log('🔵 회원가입 요청 전송:', {
        username: registerData.username,
        email: registerData.email,
        nickname: registerData.nickname,
        hasPassword: !!registerData.password,
        favorite_algorithms: registerData.favorite_algorithms
      });

      await register(registerData);
      console.log('✅ 회원가입 및 자동 로그인 성공');
      navigate('/');
    } catch (err) {
      console.error('❌ 회원가입 실패:', err);
      console.error('   에러 응답:', err.response?.data);
      console.error('   에러 메시지:', err.message);

      // 서버에서 받은 에러 메시지 표시
      let errorMessage = '회원가입에 실패했습니다';

      if (err.message && err.message !== 'Request failed with status code 400' && err.message !== 'Request failed with status code 500') {
        // AuthContext에서 파싱한 에러 메시지
        errorMessage = err.message;
      } else if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Pydantic validation error
          const messages = err.response.data.detail.map(e => {
            const field = e.loc ? e.loc[e.loc.length - 1] : '';
            const msg = e.msg || e.message || '';
            return field ? `${field}: ${msg}` : msg;
          });
          errorMessage = messages.join('\n');
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        }
      } else if (err.response?.status === 400) {
        errorMessage = '입력 정보를 확인해주세요';
      } else if (err.response?.status === 500) {
        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요';
      }

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
          <h2>회원가입</h2>
          <p className="auth-description">
            {step === 1 ? '기본 정보를 입력하세요' : '좋아하는 알고리즘을 선택하세요 (최대 3개)'}
          </p>

          {step === 1 ? (
            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="auth-form">
              <div className="form-group">
                <label>아이디</label>
                <input
                  type="text"
                  name="username"
                  className="input-field"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="아이디를 입력하세요"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>이메일</label>
                <input
                  type="email"
                  name="email"
                  className="input-field"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="이메일을 입력하세요"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>비밀번호</label>
                <input
                  type="password"
                  name="password"
                  className="input-field"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="8자 이상, 영문+숫자"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>비밀번호 확인</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="input-field"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>닉네임 (선택)</label>
                <input
                  type="text"
                  name="nickname"
                  className="input-field"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="닉네임을 입력하세요"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>자기소개 (선택)</label>
                <textarea
                  name="bio"
                  className="input-field"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="간단한 자기소개를 입력하세요"
                  rows="3"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary full-width"
                disabled={loading}
              >
                다음
              </button>
            </form>
          ) : (
            <div className="auth-form">
              <div className="algorithm-selection">
                {algorithmTypes.map((algo) => (
                  <button
                    key={algo}
                    type="button"
                    className={`algorithm-tag ${formData.favorite_algorithms.includes(algo) ? 'selected' : ''}`}
                    onClick={() => handleAlgorithmToggle(algo)}
                    disabled={loading}
                  >
                    {algo}
                  </button>
                ))}
              </div>

              <div className="selected-count">
                선택됨: {formData.favorite_algorithms.length} / 3
              </div>

              <div className="button-group">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  이전
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? '가입 중...' : '가입하기'}
                </button>
              </div>
            </div>
          )}

          <div className="auth-footer">
            <p>
              이미 계정이 있으신가요? <Link to="/login" className="auth-link">로그인</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
