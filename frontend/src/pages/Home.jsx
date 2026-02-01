import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import LoginModal from '../components/LoginModal';
import RegisterModal from '../components/RegisterModal';
import axios from 'axios';
import '../styles/Home.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Home() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    solved_count: 0,
    created_count: 0,
    attempt_count: 0,
    accepted_count: 0,
    accuracy_rate: 0
  });
  const [totalProblems, setTotalProblems] = useState(0);
  const [solvedProblems, setSolvedProblems] = useState([]);
  const [createdProblems, setCreatedProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // 홈화면 접근시 데이터 새로고침
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, problemsRes, allProblemsRes, createdRes] = await Promise.all([
        axios.get(`${API_URL}/api/profile/${user.id}/stats`, { headers }),
        axios.get(`${API_URL}/api/profile/${user.id}/solved`, { headers }),
        axios.get(`${API_URL}/api/problems`, { headers }),
        axios.get(`${API_URL}/api/problems?creator_id=${user.id}`, { headers })
      ]);

      console.log('Stats response:', statsRes.data);
      setStats(statsRes.data);
      setSolvedProblems(problemsRes.data);
      setTotalProblems(allProblemsRes.data.length);
      setCreatedProblems(createdRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="home-page">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="home-page">
          <div className="home-container">
            <div className="welcome-section">
              <h1>🏛️ Gladiator Online Judge</h1>
              <p>알고리즘 문제를 풀고 실력을 향상시켜보세요</p>
              <div className="welcome-actions">
                <button onClick={() => setShowLoginModal(true)} className="btn btn-primary">로그인</button>
                <button onClick={() => setShowRegisterModal(true)} className="btn btn-secondary">회원가입</button>
                <Link to="/problems" className="btn btn-secondary">문제 둘러보기</Link>
              </div>
            </div>
          </div>
        </div>

        {showLoginModal && (
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            onSwitchToRegister={() => {
              setShowLoginModal(false);
              setShowRegisterModal(true);
            }}
          />
        )}
        {showRegisterModal && (
          <RegisterModal
            onClose={() => setShowRegisterModal(false)}
            onSwitchToLogin={() => {
              setShowRegisterModal(false);
              setShowLoginModal(true);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="home-page">
      <div className="home-container">
        <div
          className={`profile-header ${user?.profile_background_url ? 'with-background' : ''}`}
          style={user?.profile_background_url ? { '--bg-image': `url(${user.profile_background_url})` } : {}}
        >
          <div className="profile-left">
            {user?.profile_image_url ? (
              <img src={user.profile_image_url} alt="프로필" className="profile-image" />
            ) : (
              <div className="profile-image-placeholder">
                {(user?.nickname || user?.username)?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="profile-info">
              <h1>{user?.nickname || user?.username}</h1>
              {user?.bio && <p className="profile-bio">{user.bio}</p>}
              {user?.favorite_algorithms && user.favorite_algorithms.length > 0 && (
                <div className="profile-algorithms">
                  {user.favorite_algorithms.map((algo, i) => (
                    <span key={i} className="algo-badge">{algo}</span>
                  ))}
                </div>
              )}
              <div className="profile-links">
                {user?.external_link_1 && (
                  <a href={user.external_link_1} target="_blank" rel="noopener noreferrer" className="external-link">
                    🔗 {new URL(user.external_link_1).hostname}
                  </a>
                )}
                {user?.external_link_2 && (
                  <a href={user.external_link_2} target="_blank" rel="noopener noreferrer" className="external-link">
                    🔗 {new URL(user.external_link_2).hostname}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="profile-stats-container">
            <h3>오늘도 문제를 풀어보세요</h3>
            <div className="stats-grid-compact">
              <div className="stat-card-compact">
                <div className="stat-value">{totalProblems}</div>
                <div className="stat-label">전체 문제</div>
              </div>
              <div className="stat-card-compact">
                <div className="stat-value">{stats.solved_count}</div>
                <div className="stat-label">해결한 문제</div>
              </div>
              <div className="stat-card-compact">
                <div className="stat-value">{stats.attempt_count}</div>
                <div className="stat-label">제출 횟수</div>
              </div>
              <div className="stat-card-compact">
                <div className="stat-value">{(stats.accuracy_rate || 0).toFixed(1)}%</div>
                <div className="stat-label">정답률</div>
              </div>
            </div>
          </div>
        </div>

        <div className="solved-section">
          <div className="section-header">
            <h2>최근 해결한 문제</h2>
            <Link to="/problems" className="see-all-link">모두 보기</Link>
          </div>
          {solvedProblems.length > 0 ? (
            <div className="problems-list">
              {solvedProblems.slice(0, 10).map((problem) => (
                <Link
                  key={problem.id}
                  to={`/problems/${problem.id}`}
                  className="problem-item"
                >
                  <div className="problem-title">{problem.title}</div>
                  <div className="problem-meta">
                    <span className={`difficulty-badge difficulty-${problem.difficulty}`}>
                      {problem.difficulty === 1 ? '쉬움' : problem.difficulty === 2 ? '보통' : '어려움'}
                    </span>
                    <span className="problem-stats">
                      정답률 {problem.accuracy_rate.toFixed(1)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>아직 해결한 문제가 없습니다</p>
              <Link to="/problems" className="btn btn-primary">
                문제 풀러 가기
              </Link>
            </div>
          )}
        </div>

        <div className="solved-section">
          <div className="section-header">
            <h2>내가 만든 문제</h2>
            <Link to="/create-problem" className="see-all-link">문제 만들기</Link>
          </div>
          {createdProblems.length > 0 ? (
            <div className="problems-list">
              {createdProblems.slice(0, 10).map((problem) => (
                <Link
                  key={problem.id}
                  to={`/problems/${problem.id}`}
                  className="problem-item"
                >
                  <div className="problem-title">{problem.title}</div>
                  <div className="problem-meta">
                    <span className={`difficulty-badge difficulty-${problem.difficulty}`}>
                      {problem.difficulty === 1 ? '쉬움' : problem.difficulty === 2 ? '보통' : '어려움'}
                    </span>
                    <span className="problem-stats">
                      정답률 {problem.accuracy_rate.toFixed(1)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>아직 만든 문제가 없습니다</p>
              <Link to="/create-problem" className="btn btn-primary">
                문제 만들러 가기
              </Link>
            </div>
          )}
        </div>

        <div className="quick-actions">
          <Link to="/problems" className="action-card">
            <div className="action-icon">🎯</div>
            <div className="action-title">문제 풀기</div>
            <div className="action-desc">다양한 알고리즘 문제를 풀어보세요</div>
          </Link>
          <Link to="/create-problem" className="action-card">
            <div className="action-icon">✍️</div>
            <div className="action-title">문제 만들기</div>
            <div className="action-desc">새로운 문제를 출제해보세요</div>
          </Link>
          <Link to="/friends" className="action-card">
            <div className="action-icon">👥</div>
            <div className="action-title">친구</div>
            <div className="action-desc">친구들과 함께 성장하세요</div>
          </Link>
          <Link to="/settings" className="action-card">
            <div className="action-icon">⚙️</div>
            <div className="action-title">설정</div>
            <div className="action-desc">프로필을 관리하세요</div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
