import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import '../styles/Problems.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Problems() {
  const { user } = useContext(AuthContext);
  const [problems, setProblems] = useState([]);
  const [filteredProblems, setFilteredProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    difficulty: 'all',
    algorithm: 'all',
    search: '',
    myProblems: false
  });
  const [sortBy, setSortBy] = useState('id'); // id, difficulty, solved_count, accuracy

  const difficulties = ['all', '쉬움', '보통', '어려움'];
  const algorithms = [
    'all', '동적 프로그래밍', '그리디', '그래프', 'BFS', 'DFS',
    '이진 탐색', '분할 정복', '백트래킹', '문자열',
    '트리', '정렬', '해시', '스택', '큐', '우선순위 큐',
    '투 포인터', '슬라이딩 윈도우', '비트마스킹', '수학',
    '기하학', '구현', '시뮬레이션', '완전 탐색', '최단 경로',
    '최소 신장 트리', '위상 정렬', '강한 연결 요소',
    '유니온 파인드', '세그먼트 트리', 'LCA'
  ];

  useEffect(() => {
    fetchProblems();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, problems, user, sortBy]);

  const fetchProblems = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/problems`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProblems(response.data);
    } catch (error) {
      console.error('Failed to fetch problems:', error);
      alert('문제 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...problems];

    // 내가 만든 문제 필터
    if (filters.myProblems && user) {
      filtered = filtered.filter(p => p.creator_id === user.id);
    }

    if (filters.difficulty !== 'all') {
      filtered = filtered.filter(p => p.difficulty === filters.difficulty);
    }

    if (filters.algorithm !== 'all') {
      filtered = filtered.filter(p =>
        p.algorithm_types.includes(filters.algorithm)
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // 정렬
    if (sortBy === 'id') {
      filtered.sort((a, b) => a.id - b.id);
    } else if (sortBy === 'difficulty') {
      filtered.sort((a, b) => b.difficulty - a.difficulty);
    } else if (sortBy === 'solved_count') {
      filtered.sort((a, b) => b.solved_count - a.solved_count);
    } else if (sortBy === 'accuracy') {
      filtered.sort((a, b) => b.accuracy_rate - a.accuracy_rate);
    }

    setFilteredProblems(filtered);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="problems-page">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="problems-page">
      <div className="problems-container">
        <div className="problems-header">
          <div className="header-content">
            <h1>문제 목록</h1>
            <p>{filteredProblems.length}개의 문제</p>
          </div>
          <Link to="/create-problem" className="btn btn-primary">
            문제 만들기
          </Link>
        </div>

        <div className="filters-section">
          <div className="filter-group">
            <input
              type="text"
              className="search-input"
              placeholder="문제 검색..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>

          {user && (
            <div className="filter-group">
              <label>
                <input
                  type="checkbox"
                  checked={filters.myProblems}
                  onChange={(e) => handleFilterChange('myProblems', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                내가 만든 문제만 보기
              </label>
            </div>
          )}

          <div className="filter-row">
            <div className="filter-group">
              <label>난이도</label>
              <div className="filter-buttons">
                {difficulties.map(diff => (
                  <button
                    key={diff}
                    className={`filter-btn ${filters.difficulty === diff ? 'active' : ''}`}
                    onClick={() => handleFilterChange('difficulty', diff)}
                  >
                    {diff === 'all' ? '전체' : diff}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <label>정렬</label>
              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="id">번호순</option>
                <option value="difficulty">난이도순</option>
                <option value="solved_count">해결한 사람 순</option>
                <option value="accuracy">정답률순</option>
              </select>
            </div>
          </div>

          <div className="filter-group">
            <label>알고리즘</label>
            <select
              className="filter-select"
              value={filters.algorithm}
              onChange={(e) => handleFilterChange('algorithm', e.target.value)}
            >
              <option value="all">전체</option>
              {algorithms.filter(a => a !== 'all').map(algo => (
                <option key={algo} value={algo}>{algo}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="problems-list">
          {filteredProblems.length > 0 ? (
            filteredProblems.map((problem) => (
              <Link
                key={problem.id}
                to={`/problems/${problem.id}`}
                className="problem-card"
              >
                <div className="problem-main">
                  <div className="problem-header-info">
                    <div className="problem-title-wrapper">
                      <span className="problem-number">#{problem.id}</span>
                      <h3 className="problem-title">
                        {problem.is_solved && <span className="solved-icon">✅</span>}
                        {problem.title}
                      </h3>
                    </div>
                    <span className={`difficulty-badge difficulty-${problem.difficulty}`}>
                      {problem.difficulty === 1 ? '쉬움' : problem.difficulty === 2 ? '보통' : '어려움'}
                    </span>
                  </div>
                  <p className="problem-description">
                    {problem.description.length > 150
                      ? problem.description.substring(0, 150) + '...'
                      : problem.description}
                  </p>
                  <div className="problem-footer">
                    <div className="algorithm-tags">
                      {problem.algorithm_types.slice(0, 3).map((algo, i) => (
                        <span key={i} className="algorithm-tag">{algo}</span>
                      ))}
                      {problem.algorithm_types.length > 3 && (
                        <span className="algorithm-tag">+{problem.algorithm_types.length - 3}</span>
                      )}
                    </div>
                    <div className="problem-stats">
                      <span>✓ {problem.solved_count || 0}</span>
                      <span>제출 {problem.submission_count || 0}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <p>조건에 맞는 문제가 없습니다</p>
              <button
                className="btn btn-secondary"
                onClick={() => setFilters({ difficulty: 'all', algorithm: 'all', search: '', myProblems: false })}
              >
                필터 초기화
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Problems;
