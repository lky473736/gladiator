import { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { AuthContext } from '../context/AuthContext';
import '../styles/ProblemDetail.css';

// Markdown with LaTeX support component
function MarkdownWithLatex({ children }) {
  if (!children) return null;

  // Split content by LaTeX delimiters
  const parts = [];
  let remaining = children;
  let key = 0;

  while (remaining.length > 0) {
    // Check for block math ($$...$$)
    const blockMatch = remaining.match(/\$\$([\s\S]*?)\$\$/);
    if (blockMatch && (remaining.indexOf('$$') === blockMatch.index || remaining.indexOf('$$') < remaining.indexOf('$'))) {
      // Add text before block math
      if (blockMatch.index > 0) {
        parts.push(
          <ReactMarkdown key={key++}>
            {remaining.slice(0, blockMatch.index)}
          </ReactMarkdown>
        );
      }
      // Add block math
      parts.push(<BlockMath key={key++} math={blockMatch[1]} />);
      remaining = remaining.slice(blockMatch.index + blockMatch[0].length);
      continue;
    }

    // Check for inline math ($...$)
    const inlineMatch = remaining.match(/\$([^\$\n]+?)\$/);
    if (inlineMatch) {
      // Add text before inline math
      if (inlineMatch.index > 0) {
        parts.push(
          <ReactMarkdown key={key++}>
            {remaining.slice(0, inlineMatch.index)}
          </ReactMarkdown>
        );
      }
      // Add inline math
      parts.push(<InlineMath key={key++} math={inlineMatch[1]} />);
      remaining = remaining.slice(inlineMatch.index + inlineMatch[0].length);
      continue;
    }

    // No more LaTeX, add remaining text
    parts.push(<ReactMarkdown key={key++}>{remaining}</ReactMarkdown>);
    break;
  }

  return <>{parts}</>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Submission Result Component with detailed test case info
function SubmissionResult({ submission, statusColors }) {
  const [expanded, setExpanded] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDetailedResult = async () => {
    if (detailData) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/submissions/${submission.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetailData(response.data);
      setExpanded(true);
    } catch (error) {
      console.error('Failed to fetch submission details:', error);
      alert('제출 상세 정보를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'Accepted') return '✅';
    if (status === 'Wrong Answer') return '❌';
    if (status === 'Time Limit Exceeded') return '⏰';
    if (status === 'Runtime Error') return '💥';
    if (status === 'Compile Error') return '🔨';
    if (status === 'Presentation Error') return '📝';
    if (status === 'Memory Limit Exceeded') return '💾';
    return '⏳';
  };

  return (
    <div className="submission-item">
      <div
        className="submission-header"
        onClick={fetchDetailedResult}
        style={{ cursor: 'pointer' }}
      >
        <div className="submission-info">
          <span
            className="submission-status"
            style={{
              color: statusColors[submission.status],
              fontWeight: '600',
              fontSize: '15px'
            }}
          >
            {getStatusIcon(submission.status)} {submission.status}
          </span>
          <span className="submission-time">
            {new Date(submission.submitted_at).toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="submission-stats">
          {submission.execution_time !== null && (
            <span>⏱️ {submission.execution_time}ms</span>
          )}
          {submission.memory_used !== null && (
            <span>💾 {submission.memory_used}KB</span>
          )}
          <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && detailData && (
        <div className="submission-details-panel">
          {/* Overall Stats */}
          <div className="submission-summary">
            <div className="summary-item">
              <strong>상태:</strong> {getStatusIcon(detailData.status)} {detailData.status}
            </div>
            {detailData.passed !== undefined && detailData.total !== undefined && (
              <div className="summary-item">
                <strong>테스트케이스:</strong> {detailData.passed} / {detailData.total} 통과
              </div>
            )}
            {detailData.execution_time && (
              <div className="summary-item">
                <strong>실행 시간:</strong> {detailData.execution_time}ms
              </div>
            )}
            {detailData.memory_used && (
              <div className="summary-item">
                <strong>메모리:</strong> {detailData.memory_used}KB
              </div>
            )}
          </div>

          {/* Error Message */}
          {detailData.error_message && (
            <div className="error-message-box">
              <h4>❌ 오류 메시지</h4>
              <pre>{detailData.error_message}</pre>
            </div>
          )}

          {/* Failed Test Case Details */}
          {detailData.failed_test_case && (
            <div className="failed-test-case">
              <h4>❌ 실패한 테스트케이스 (#{detailData.failed_test_case.id})</h4>
              <div className="test-case-details">
                <div className="test-case-section">
                  <strong>입력:</strong>
                  <pre>{detailData.failed_test_case.input}</pre>
                </div>
                <div className="test-case-section">
                  <strong>기대 출력:</strong>
                  <pre>{detailData.failed_test_case.expected}</pre>
                </div>
                <div className="test-case-section">
                  <strong>실제 출력:</strong>
                  <pre>{detailData.failed_test_case.actual !== null && detailData.failed_test_case.actual !== undefined ? detailData.failed_test_case.actual : '(출력 없음)'}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Passed Test Cases */}
          {detailData.all_test_cases && detailData.all_test_cases.length > 0 && (
            <div className="all-test-cases">
              <h4>✅ 통과한 테스트케이스 ({detailData.all_test_cases.filter(tc => tc.passed).length}개)</h4>
              <div className="test-cases-grid">
                {detailData.all_test_cases
                  .filter(tc => tc.passed)
                  .map((tc, idx) => (
                  <div
                    key={idx}
                    className="test-case-badge passed"
                  >
                    ✅ #{tc.id}
                    <div className="test-case-tooltip">
                      <div className="tooltip-section">
                        <strong>입력:</strong>
                        <pre>{tc.input}</pre>
                      </div>
                      <div className="tooltip-section">
                        <strong>기댓값:</strong>
                        <pre>{tc.expected_output}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Results from judging */}
          {detailData.test_results && detailData.test_results.length > 0 && (
            <div className="test-results-detail">
              <h4>🔍 테스트케이스 상세 결과</h4>
              {detailData.test_results.map((result, idx) => (
                <div key={idx} className="test-result-item">
                  <span className={result.passed ? 'test-passed' : 'test-failed'}>
                    {result.passed ? '✅' : '❌'} 테스트케이스 #{result.test_case_id}
                  </span>
                  <span className="test-status">{result.status}</span>
                  {result.execution_time !== undefined && (
                    <span className="test-time">⏱️ {result.execution_time}ms</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Source Code */}
          {detailData.code && (
            <div className="source-code">
              <h4>📝 제출 코드</h4>
              <pre><code>{detailData.code}</code></pre>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="submission-loading">
          <p>로딩 중...</p>
        </div>
      )}
    </div>
  );
}

function ProblemDetail() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showCreatorProfile, setShowCreatorProfile] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    input_description: '',
    output_description: '',
    sample_input: '',
    sample_output: '',
    hint: '',
    time_limit: 1000,
    memory_limit: 256,
    difficulty: 1,
    algorithm_types: []
  });

  const statusColors = {
    'Waiting': '#666666',
    'Preparing': '#3182ce',
    'Judging': '#3182ce',
    'Accepted': '#38a169',
    'Wrong Answer': '#e53e3e',
    'Presentation Error': '#d69e2e',
    'Time Limit Exceeded': '#e53e3e',
    'Memory Limit Exceeded': '#e53e3e',
    'Output Limit Exceeded': '#e53e3e',
    'Runtime Error': '#e53e3e',
    'Compile Error': '#e53e3e'
  };

  useEffect(() => {
    fetchProblem();
    fetchSubmissions();
  }, [id]);

  const fetchProblem = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/problems/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProblem(response.data);

      // 수정 폼 데이터 초기화
      setEditFormData({
        title: response.data.title || '',
        description: response.data.description || '',
        input_description: response.data.input_description || '',
        output_description: response.data.output_description || '',
        sample_input: response.data.sample_input || '',
        sample_output: response.data.sample_output || '',
        hint: response.data.hint || '',
        time_limit: response.data.time_limit || 1000,
        memory_limit: response.data.memory_limit || 256,
        difficulty: response.data.difficulty || 1,
        algorithm_types: response.data.algorithm_types || []
      });
    } catch (error) {
      console.error('Failed to fetch problem:', error);
      alert('문제를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCreatorProfile = async () => {
    if (!problem?.creator_id) return;

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [userRes, statsRes, solvedRes, createdRes] = await Promise.all([
        axios.get(`${API_URL}/users/${problem.creator_id}`, { headers }),
        axios.get(`${API_URL}/api/profile/${problem.creator_id}/stats`, { headers }),
        axios.get(`${API_URL}/api/profile/${problem.creator_id}/solved`, { headers }),
        axios.get(`${API_URL}/api/problems?creator_id=${problem.creator_id}`, { headers })
      ]);

      setCreatorProfile({
        user: userRes.data,
        stats: statsRes.data,
        solvedProblems: solvedRes.data,
        createdProblems: createdRes.data
      });
      setShowCreatorProfile(true);
    } catch (error) {
      console.error('Failed to fetch creator profile:', error);
      alert('제작자 프로필을 불러올 수 없습니다');
    }
  };

  const closeCreatorProfile = () => {
    setShowCreatorProfile(false);
    setCreatorProfile(null);
  };

  const fetchSubmissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/problems/${id}/submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubmissions(response.data);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    }
  };

  const handleDeleteProblem = async () => {
    if (!window.confirm('정말로 이 문제를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/problems/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('문제가 삭제되었습니다');
      navigate('/problems');
    } catch (error) {
      console.error('Failed to delete problem:', error);
      alert('문제 삭제에 실패했습니다');
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: value
    });
  };

  const handleAlgorithmToggle = (algo) => {
    const current = editFormData.algorithm_types;
    if (current.includes(algo)) {
      setEditFormData({
        ...editFormData,
        algorithm_types: current.filter(a => a !== algo)
      });
    } else {
      setEditFormData({
        ...editFormData,
        algorithm_types: [...current, algo]
      });
    }
  };

  const handleUpdateProblem = async () => {
    if (!editFormData.title || !editFormData.description) {
      alert('제목과 설명은 필수입니다');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/problems/${id}`,
        editFormData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('문제가 수정되었습니다');
      setIsEditing(false);
      fetchProblem();
    } catch (error) {
      console.error('Failed to update problem:', error);
      alert('문제 수정에 실패했습니다');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.cpp')) {
        setMessage('C++ 파일만 제출 가능합니다 (.cpp)');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setMessage('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('파일을 선택해주세요');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/submissions?problem_id=${id}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage('제출이 완료되었습니다!');
      setFile(null);
      fetchSubmissions();

      // 제출 후 상태 업데이트를 위해 폴링
      pollSubmissionStatus(response.data.id);
    } catch (error) {
      setMessage(error.response?.data?.detail || '제출에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const pollSubmissionStatus = async (submissionId) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/submissions/${submissionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const status = response.data.status;
        if (!['Waiting', 'Preparing', 'Judging'].includes(status) || attempts >= maxAttempts) {
          clearInterval(poll);
          fetchSubmissions();
        }
        attempts++;
      } catch (error) {
        clearInterval(poll);
      }
    }, 2000);
  };

  if (loading) {
    return (
      <div className="problem-detail-page">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="problem-detail-page">
        <div className="error-state">
          <p>문제를 찾을 수 없습니다</p>
          <Link to="/problems" className="btn btn-primary">문제 목록으로</Link>
        </div>
      </div>
    );
  }

  const getDifficultyText = (diff) => {
    if (diff === 1) return '쉬움';
    if (diff === 2) return '보통';
    if (diff === 3) return '어려움';
    return diff;
  };

  return (
    <div className="problem-detail-page page-fade-in">
      {/* 헤더 */}
      <header className="detail-header">
        <div className="breadcrumb">
          <Link to="/problems">← 문제 목록</Link>
        </div>
        {user && user.id === problem.creator_id && (
          <div className="problem-actions">
            <button
              className="btn btn-secondary"
              onClick={handleEditToggle}
            >
              {isEditing ? '취소' : '수정'}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleDeleteProblem}
            >
              삭제
            </button>
          </div>
        )}
      </header>

      {/* 메인 콘텐츠 */}
      <main className="detail-main">
        <div className="problem-emoji">💻</div>

        <h1 className="problem-header-title">{problem.title}</h1>

        <div className="problem-meta-info">
          <span className="meta-item">
            <span className={`difficulty-badge ${problem.difficulty}`}>
              {getDifficultyText(problem.difficulty)}
            </span>
          </span>
          <span className="meta-item creator-link" onClick={handleViewCreatorProfile} style={{ cursor: 'pointer' }}>
            ✍️ {problem.creator_nickname || problem.creator_username}
          </span>
          <span className="meta-item">📝 제출 {problem.submission_count || 0}</span>
          <span className="meta-item">✅ 정답 {problem.accepted_count || 0}</span>
          <span className="meta-item">⏱️ {problem.time_limit}ms</span>
          <span className="meta-item">💾 {problem.memory_limit}MB</span>
        </div>

        <div className="algorithm-tags-section">
          {problem.algorithm_types.map((algo, i) => (
            <span key={i} className="algorithm-tag">{algo}</span>
          ))}
        </div>

        {isEditing ? (
          <div className="problem-edit-form" style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h2>문제 수정</h2>

            <div className="form-group">
              <label>제목 *</label>
              <input
                type="text"
                name="title"
                value={editFormData.title}
                onChange={handleEditChange}
                className="input-field"
              />
            </div>

            <div className="form-group">
              <label>설명 *</label>
              <textarea
                name="description"
                value={editFormData.description}
                onChange={handleEditChange}
                className="input-field"
                rows="6"
              />
            </div>

            <div className="form-group">
              <label>입력 설명</label>
              <textarea
                name="input_description"
                value={editFormData.input_description}
                onChange={handleEditChange}
                className="input-field"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>출력 설명</label>
              <textarea
                name="output_description"
                value={editFormData.output_description}
                onChange={handleEditChange}
                className="input-field"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>예제 입력</label>
              <textarea
                name="sample_input"
                value={editFormData.sample_input}
                onChange={handleEditChange}
                className="input-field"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>예제 출력</label>
              <textarea
                name="sample_output"
                value={editFormData.sample_output}
                onChange={handleEditChange}
                className="input-field"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>힌트</label>
              <textarea
                name="hint"
                value={editFormData.hint}
                onChange={handleEditChange}
                className="input-field"
                rows="2"
              />
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '20px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>시간 제한 (ms)</label>
                <input
                  type="number"
                  name="time_limit"
                  value={editFormData.time_limit}
                  onChange={handleEditChange}
                  className="input-field"
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label>메모리 제한 (MB)</label>
                <input
                  type="number"
                  name="memory_limit"
                  value={editFormData.memory_limit}
                  onChange={handleEditChange}
                  className="input-field"
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label>난이도</label>
                <select
                  name="difficulty"
                  value={editFormData.difficulty}
                  onChange={handleEditChange}
                  className="input-field"
                >
                  <option value={1}>쉬움</option>
                  <option value={2}>보통</option>
                  <option value={3}>어려움</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>알고리즘 유형</label>
              <div className="algorithm-selection" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                {['동적 프로그래밍', '그리디', '그래프', 'BFS', 'DFS', '이진 탐색', '분할 정복', '백트래킹', '문자열', '트리', '정렬', '해시', '스택', '큐', '우선순위 큐'].map((algo) => (
                  <button
                    key={algo}
                    type="button"
                    onClick={() => handleAlgorithmToggle(algo)}
                    className={`algorithm-tag ${editFormData.algorithm_types.includes(algo) ? 'selected' : ''}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: editFormData.algorithm_types.includes(algo) ? '2px solid #4CAF50' : '1px solid #ddd',
                      backgroundColor: editFormData.algorithm_types.includes(algo) ? '#e8f5e9' : 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {algo}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleUpdateProblem}
                className="btn btn-primary"
              >
                저장
              </button>
              <button
                type="button"
                onClick={handleEditToggle}
                className="btn btn-secondary"
              >
                취소
              </button>
            </div>
          </div>
        ) : null}

        <div className="problem-content">
          <section className="problem-section">
            <h2>문제 설명</h2>
            <div className="content-box">
              <MarkdownWithLatex>{problem.description}</MarkdownWithLatex>
            </div>
          </section>

          <section className="problem-section">
            <h2>입력</h2>
            <div className="content-box">
              <MarkdownWithLatex>{problem.input_description}</MarkdownWithLatex>
            </div>
          </section>

          <section className="problem-section">
            <h2>출력</h2>
            <div className="content-box">
              <MarkdownWithLatex>{problem.output_description}</MarkdownWithLatex>
            </div>
          </section>

          {problem.sample_input && problem.sample_output && (
            <section className="problem-section">
              <h2>예제</h2>
              <div className="example-grid">
                <div className="example-box">
                  <h3>입력</h3>
                  <pre>{problem.sample_input}</pre>
                </div>
                <div className="example-box">
                  <h3>출력</h3>
                  <pre>{problem.sample_output}</pre>
                </div>
              </div>
            </section>
          )}

          {problem.hint && (
            <section className="problem-section">
              <h2>💡 힌트</h2>
              <div className="content-box">
                <MarkdownWithLatex>{problem.hint}</MarkdownWithLatex>
              </div>
            </section>
          )}
        </div>

        <section className="problem-section submit-section">
          <h2>📤 제출하기</h2>
          <form onSubmit={handleSubmit} className="submit-form">
            <div className="file-input-wrapper">
              <input
                type="file"
                id="code-file"
                accept=".cpp"
                onChange={handleFileChange}
                disabled={submitting}
              />
              <label htmlFor="code-file" className="file-label">
                {file ? `✅ ${file.name}` : '📁 C++ 파일 선택 (.cpp)'}
              </label>
            </div>
            {message && (
              <div className={`message ${message.includes('실패') || message.includes('가능') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}
            <button
              type="submit"
              className="btn btn-primary full-width"
              disabled={!file || submitting}
            >
              {submitting ? '⏳ 제출 중...' : '🚀 제출하기'}
            </button>
          </form>
        </section>

        <section className="problem-section submissions-section">
          <h2>📊 제출 기록</h2>
          {submissions.length > 0 ? (
            <div className="submissions-list">
              {submissions.map((sub) => (
                <SubmissionResult key={sub.id} submission={sub} statusColors={statusColors} />
              ))}
            </div>
          ) : (
            <div className="empty-submissions">
              <p>아직 제출 기록이 없습니다</p>
            </div>
          )}
        </section>
      </main>

      {showCreatorProfile && creatorProfile && (
        <div className="profile-modal-overlay" onClick={closeCreatorProfile}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeCreatorProfile}>✕</button>

            <div
              className={`modal-profile-header ${creatorProfile.user.profile_background_url ? 'with-background' : ''}`}
              style={creatorProfile.user.profile_background_url ? { '--bg-image': `url(${creatorProfile.user.profile_background_url})` } : {}}
            >
              <div className="modal-profile-left">
                {creatorProfile.user.profile_image_url ? (
                  <img src={creatorProfile.user.profile_image_url} alt="프로필" className="modal-profile-image" />
                ) : (
                  <div className="modal-profile-image-placeholder">
                    {(creatorProfile.user.nickname || creatorProfile.user.username)?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="modal-profile-info">
                  <h1>{creatorProfile.user.nickname || creatorProfile.user.username}</h1>
                  {creatorProfile.user.bio && <p className="modal-profile-bio">{creatorProfile.user.bio}</p>}
                  {creatorProfile.user.favorite_algorithms && creatorProfile.user.favorite_algorithms.length > 0 && (
                    <div className="modal-profile-algorithms">
                      {creatorProfile.user.favorite_algorithms.map((algo, i) => (
                        <span key={i} className="modal-algo-badge">{algo}</span>
                      ))}
                    </div>
                  )}
                  <div className="modal-profile-links">
                    {creatorProfile.user.external_link_1 && (
                      <a href={creatorProfile.user.external_link_1} target="_blank" rel="noopener noreferrer" className="modal-external-link">
                        🔗 {new URL(creatorProfile.user.external_link_1).hostname}
                      </a>
                    )}
                    {creatorProfile.user.external_link_2 && (
                      <a href={creatorProfile.user.external_link_2} target="_blank" rel="noopener noreferrer" className="modal-external-link">
                        🔗 {new URL(creatorProfile.user.external_link_2).hostname}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-profile-stats-container">
                <h3>통계</h3>
                <div className="modal-stats-grid">
                  <div className="modal-stat-card">
                    <div className="modal-stat-value">{creatorProfile.stats.solved_count}</div>
                    <div className="modal-stat-label">해결한 문제</div>
                  </div>
                  <div className="modal-stat-card">
                    <div className="modal-stat-value">{creatorProfile.stats.attempt_count}</div>
                    <div className="modal-stat-label">제출 횟수</div>
                  </div>
                  <div className="modal-stat-card">
                    <div className="modal-stat-value">{(creatorProfile.stats.accuracy_rate || 0).toFixed(1)}%</div>
                    <div className="modal-stat-label">정답률</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-problems-section">
              <h2>최근 해결한 문제</h2>
              {creatorProfile.solvedProblems.length > 0 ? (
                <div className="modal-problems-list">
                  {creatorProfile.solvedProblems.slice(0, 5).map((problem) => (
                    <Link
                      key={problem.id}
                      to={`/problems/${problem.id}`}
                      className="modal-problem-item"
                      onClick={closeCreatorProfile}
                    >
                      <div className="modal-problem-title">{problem.title}</div>
                      <div className="modal-problem-meta">
                        <span className={`modal-difficulty-badge difficulty-${problem.difficulty}`}>
                          {problem.difficulty === 1 ? '쉬움' : problem.difficulty === 2 ? '보통' : '어려움'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="modal-empty">아직 해결한 문제가 없습니다</p>
              )}
            </div>

            <div className="modal-problems-section">
              <h2>만든 문제</h2>
              {creatorProfile.createdProblems.length > 0 ? (
                <div className="modal-problems-list">
                  {creatorProfile.createdProblems.slice(0, 5).map((problem) => (
                    <Link
                      key={problem.id}
                      to={`/problems/${problem.id}`}
                      className="modal-problem-item"
                      onClick={closeCreatorProfile}
                    >
                      <div className="modal-problem-title">{problem.title}</div>
                      <div className="modal-problem-meta">
                        <span className={`modal-difficulty-badge difficulty-${problem.difficulty}`}>
                          {problem.difficulty === 1 ? '쉬움' : problem.difficulty === 2 ? '보통' : '어려움'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="modal-empty">아직 만든 문제가 없습니다</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProblemDetail;
