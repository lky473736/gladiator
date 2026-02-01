import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import MDEditor from '@uiw/react-md-editor';
import '../styles/CreateProblem.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function CreateProblem() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    input_format: '',
    output_format: '',
    constraints: '',
    difficulty: '보통',
    time_limit: 1000,
    memory_limit: 256,
    algorithm_types: []
  });
  const [examples, setExamples] = useState([{ input: '', output: '' }]);
  const [testCases, setTestCases] = useState([]);
  const [solutionCode, setSolutionCode] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    const current = formData.algorithm_types;
    if (current.includes(algo)) {
      setFormData({
        ...formData,
        algorithm_types: current.filter(a => a !== algo)
      });
    } else {
      setFormData({
        ...formData,
        algorithm_types: [...current, algo]
      });
    }
  };

  const handleAddExample = () => {
    setExamples([...examples, { input: '', output: '' }]);
  };

  const handleRemoveExample = (index) => {
    if (examples.length > 1) {
      setExamples(examples.filter((_, i) => i !== index));
    }
  };

  const handleExampleChange = (index, field, value) => {
    const updated = [...examples];
    updated[index][field] = value;
    setExamples(updated);
  };

  const handleAddTestCase = () => {
    setTestCases([...testCases, { input: '', output: '', is_sample: false }]);
  };

  const handleRemoveTestCase = (index) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const handleTestCaseChange = (index, field, value) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const handleSolutionFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.cpp')) {
        alert('C++ 파일만 업로드 가능합니다 (.cpp)');
        setSolutionCode(null);
        return;
      }
      setSolutionCode(file);
      setError('');
    }
  };

  const validateStep1 = () => {
    if (!formData.title || !formData.description) {
      alert('제목과 설명은 필수입니다');
      return false;
    }
    if (formData.algorithm_types.length === 0) {
      alert('최소 1개의 알고리즘 유형을 선택해주세요');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (testCases.length < 10) {
      alert('최소 10개의 테스트 케이스가 필요합니다');
      return false;
    }
    for (let tc of testCases) {
      if (tc.input === undefined || tc.output === undefined) {
        alert('테스트 케이스의 입출력 필드가 누락되었습니다');
        return false;
      }
    }
    if (!solutionCode) {
      alert('정답 코드를 업로드해주세요');
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

  const handleSubmit = async () => {
    setError('');
    if (!validateStep2()) return;

    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      // 솔루션 코드 읽기
      const solutionText = await solutionCode.text();

      // 예제를 포맷팅
      const sample_input = examples.map(ex => ex.input).join('\n---\n');
      const sample_output = examples.map(ex => ex.output).join('\n---\n');

      // 난이도를 숫자로 변환
      const difficultyMap = { '쉬움': 1, '보통': 3, '어려움': 5 };

      // 문제 생성 요청
      const problemData = {
        title: formData.title,
        description: formData.description,
        input_description: formData.input_format || '',
        output_description: formData.output_format || '',
        sample_input,
        sample_output,
        hint: formData.constraints || '',
        time_limit: formData.time_limit,
        memory_limit: formData.memory_limit,
        difficulty: difficultyMap[formData.difficulty],
        algorithm_types: formData.algorithm_types,
        test_cases: testCases.map(tc => ({
          input_data: tc.input,
          output_data: tc.output,
          is_sample: false
        })),
        solution_code: solutionText
      };

      console.log('📝 문제 생성 요청:', problemData);

      const response = await axios.post(
        `${API_URL}/api/problems`,
        problemData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✅ 문제 생성 성공:', response.data);
      alert('✅ 문제가 성공적으로 생성되었습니다!');
      navigate(`/problems/${response.data.id}`);
    } catch (err) {
      console.error('❌ 문제 생성 실패:', err);
      console.error('   에러 응답:', err.response?.data);

      let errorMessage = '문제 생성에 실패했습니다';

      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;

        if (typeof detail === 'object' && detail.message) {
          // 구조화된 에러 객체
          errorMessage = detail.message;

          // 런타임 에러나 컴파일 에러 등 상세 정보 추가
          if (detail.error_message) {
            errorMessage += `\n\n에러 상세:\n${detail.error_message}`;
          }

          // 실패한 테스트케이스 정보
          if (detail.failed_test_case) {
            const tc = detail.failed_test_case;
            errorMessage += `\n\n실패한 테스트케이스:`;
            errorMessage += `\n- 입력: ${tc.input.substring(0, 100)}${tc.input.length > 100 ? '...' : ''}`;
            errorMessage += `\n- 기대 출력: ${tc.expected.substring(0, 100)}${tc.expected.length > 100 ? '...' : ''}`;
            if (tc.actual) {
              errorMessage += `\n- 실제 출력: ${tc.actual.substring(0, 100)}${tc.actual.length > 100 ? '...' : ''}`;
            }
          }

          if (detail.passed !== undefined && detail.total !== undefined) {
            errorMessage += `\n\n통과한 테스트케이스: ${detail.passed}/${detail.total}`;
          }
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-problem-page">
      <div className="create-problem-container">
        <div className="create-header">
          <h1>문제 만들기</h1>
          <div className="step-indicator">
            <span className={step >= 1 ? 'active' : ''}>1. 문제 작성</span>
            <span className={step >= 2 ? 'active' : ''}>2. 테스트 케이스</span>
          </div>
        </div>

        {step === 1 ? (
          <div className="step-content">
            <div className="form-section">
              <h2>기본 정보</h2>
              <div className="form-group">
                <label>문제 제목 *</label>
                <input
                  type="text"
                  name="title"
                  className="input-field"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="문제 제목을 입력하세요"
                  disabled={loading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>난이도</label>
                  <select
                    name="difficulty"
                    className="input-field"
                    value={formData.difficulty}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="쉬움">쉬움</option>
                    <option value="보통">보통</option>
                    <option value="어려움">어려움</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>시간 제한 (ms)</label>
                  <input
                    type="number"
                    name="time_limit"
                    className="input-field"
                    value={formData.time_limit}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label>메모리 제한 (MB)</label>
                  <input
                    type="number"
                    name="memory_limit"
                    className="input-field"
                    value={formData.memory_limit}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>알고리즘 유형 *</label>
                <div className="algorithm-selection">
                  {algorithmTypes.map((algo) => (
                    <button
                      key={algo}
                      type="button"
                      className={`algorithm-tag ${formData.algorithm_types.includes(algo) ? 'selected' : ''}`}
                      onClick={() => handleAlgorithmToggle(algo)}
                      disabled={loading}
                    >
                      {algo}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h2>문제 설명 *</h2>
              <div className="markdown-editor">
                <MDEditor
                  value={formData.description}
                  onChange={(val) => setFormData({ ...formData, description: val || '' })}
                  height={300}
                  preview="live"
                />
              </div>
            </div>

            <div className="form-section">
              <h2>입력 형식</h2>
              <div className="markdown-editor">
                <MDEditor
                  value={formData.input_format}
                  onChange={(val) => setFormData({ ...formData, input_format: val || '' })}
                  height={200}
                  preview="live"
                />
              </div>
            </div>

            <div className="form-section">
              <h2>출력 형식</h2>
              <div className="markdown-editor">
                <MDEditor
                  value={formData.output_format}
                  onChange={(val) => setFormData({ ...formData, output_format: val || '' })}
                  height={200}
                  preview="live"
                />
              </div>
            </div>

            <div className="form-section">
              <div className="section-header-with-button">
                <h2>예제</h2>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddExample}
                  disabled={loading}
                >
                  + 예제 추가
                </button>
              </div>
              <div className="examples-list">
                {examples.map((example, index) => (
                  <div key={index} className="example-item">
                    <div className="example-header">
                      <h3>예제 {index + 1}</h3>
                      {examples.length > 1 && (
                        <button
                          type="button"
                          className="btn-remove"
                          onClick={() => handleRemoveExample(index)}
                          disabled={loading}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <div className="example-inputs">
                      <div className="form-group">
                        <label>입력</label>
                        <textarea
                          className="input-field"
                          value={example.input}
                          onChange={(e) => handleExampleChange(index, 'input', e.target.value)}
                          rows="4"
                          disabled={loading}
                          placeholder="예제 입력을 작성하세요"
                        />
                      </div>
                      <div className="form-group">
                        <label>출력</label>
                        <textarea
                          className="input-field"
                          value={example.output}
                          onChange={(e) => handleExampleChange(index, 'output', e.target.value)}
                          rows="4"
                          disabled={loading}
                          placeholder="예제 출력을 작성하세요"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h2>제약사항</h2>
              <div className="markdown-editor">
                <MDEditor
                  value={formData.constraints}
                  onChange={(val) => setFormData({ ...formData, constraints: val || '' })}
                  height={150}
                  preview="live"
                />
              </div>
            </div>

            <button
              className="btn btn-primary full-width"
              onClick={handleNext}
              disabled={loading}
            >
              다음
            </button>
          </div>
        ) : (
          <div className="step-content">
            <div className="form-section">
              <h2>테스트 케이스 (최소 10개)</h2>
              <p className="section-description">
                문제를 검증하기 위한 테스트 케이스를 작성하세요.
                정답 코드로 모든 테스트 케이스를 통과해야 문제가 생성됩니다.
              </p>

              <div className="test-cases-list">
                {testCases.map((tc, index) => (
                  <div key={index} className="test-case-item">
                    <div className="test-case-header">
                      <h3>테스트 케이스 {index + 1}</h3>
                      <button
                        className="btn-remove"
                        onClick={() => handleRemoveTestCase(index)}
                        disabled={loading}
                      >
                        삭제
                      </button>
                    </div>
                    <div className="test-case-inputs">
                      <div className="form-group">
                        <label>입력</label>
                        <textarea
                          className="input-field"
                          value={tc.input}
                          onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                          rows="4"
                          disabled={loading}
                        />
                      </div>
                      <div className="form-group">
                        <label>출력</label>
                        <textarea
                          className="input-field"
                          value={tc.output}
                          onChange={(e) => handleTestCaseChange(index, 'output', e.target.value)}
                          rows="4"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-secondary full-width"
                onClick={handleAddTestCase}
                disabled={loading}
              >
                테스트 케이스 추가
              </button>
            </div>

            <div className="form-section">
              <h2>정답 코드 *</h2>
              <p className="section-description">
                정답 코드를 업로드하여 테스트 케이스를 검증합니다.
                모든 테스트 케이스를 통과해야 문제가 생성됩니다.
              </p>
              <div className="file-input-wrapper">
                <input
                  type="file"
                  id="solution-file"
                  accept=".cpp"
                  onChange={handleSolutionFileChange}
                  disabled={loading}
                />
                <label htmlFor="solution-file" className="file-label">
                  {solutionCode ? solutionCode.name : 'C++ 파일 선택 (.cpp)'}
                </label>
              </div>
            </div>

            <div className="button-group">
              <button
                className="btn btn-secondary"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                이전
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? '생성 중...' : '문제 생성'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateProblem;
