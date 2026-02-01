import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import '../styles/ProfileSettings.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ProfileSettings() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nickname: '',
    bio: '',
    profile_image_url: '',
    profile_background_url: '',
    favorite_algorithms: [],
    external_link_1: '',
    external_link_2: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const algorithmTypes = [
    '동적 프로그래밍', '그리디', '그래프', 'BFS', 'DFS',
    '이진 탐색', '분할 정복', '백트래킹', '문자열',
    '트리', '정렬', '해시', '스택', '큐', '우선순위 큐',
    '투 포인터', '슬라이딩 윈도우', '비트마스킹', '수학',
    '기하학', '구현', '시뮬레이션', '완전 탐색', '최단 경로',
    '최소 신장 트리', '위상 정렬', '강한 연결 요소',
    '유니온 파인드', '세그먼트 트리', 'LCA'
  ];

  useEffect(() => {
    if (user) {
      setFormData({
        nickname: user.nickname || '',
        bio: user.bio || '',
        profile_image_url: user.profile_image_url || '',
        profile_background_url: user.profile_background_url || '',
        favorite_algorithms: user.favorite_algorithms || [],
        external_link_1: user.external_link_1 || '',
        external_link_2: user.external_link_2 || ''
      });
    }
  }, [user]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/api/profile`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update user in context and localStorage
      const updatedUser = { ...user, ...response.data };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      alert('프로필이 업데이트되었습니다');
      navigate('/');
    } catch (error) {
      setMessage(error.response?.data?.detail || '프로필 업데이트에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="profile-settings-page">
      <div className="profile-settings-container">
        <div className="settings-header">
          <h1>프로필 설정</h1>
          <p>나만의 프로필을 꾸며보세요</p>
        </div>

        {message && (
          <div className={`message ${message.includes('실패') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-section">
            <h2>기본 정보</h2>
            <div className="form-group">
              <label>닉네임</label>
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
              <label>자기소개</label>
              <textarea
                name="bio"
                className="input-field"
                value={formData.bio}
                onChange={handleChange}
                placeholder="간단한 자기소개를 입력하세요"
                rows="4"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-section">
            <h2>프로필 이미지</h2>
            <div className="form-group">
              <label>프로필 이미지 URL</label>
              <input
                type="url"
                name="profile_image_url"
                className="input-field"
                value={formData.profile_image_url}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
                disabled={loading}
              />
              {formData.profile_image_url && (
                <div className="image-preview">
                  <img
                    src={formData.profile_image_url}
                    alt="프로필 미리보기"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>배경 이미지 URL</label>
              <input
                type="url"
                name="profile_background_url"
                className="input-field"
                value={formData.profile_background_url}
                onChange={handleChange}
                placeholder="https://example.com/background.jpg"
                disabled={loading}
              />
              {formData.profile_background_url && (
                <div className="image-preview background">
                  <img
                    src={formData.profile_background_url}
                    alt="배경 미리보기"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h2>좋아하는 알고리즘 (최대 3개)</h2>
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
          </div>

          <div className="form-section">
            <h2>외부 링크</h2>
            <div className="form-group">
              <label>외부 링크 1 (선택)</label>
              <input
                type="url"
                name="external_link_1"
                className="input-field"
                value={formData.external_link_1}
                onChange={handleChange}
                placeholder="https://github.com/username"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>외부 링크 2 (선택)</label>
              <input
                type="url"
                name="external_link_2"
                className="input-field"
                value={formData.external_link_2}
                onChange={handleChange}
                placeholder="https://blog.example.com"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary full-width"
            disabled={loading}
          >
            {loading ? '저장 중...' : '저장하기'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfileSettings;
