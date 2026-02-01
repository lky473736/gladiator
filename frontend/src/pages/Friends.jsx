import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import '../styles/Friends.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Friends() {
  const { user } = useContext(AuthContext);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendProfile, setFriendProfile] = useState(null);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(response.data);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/users/search?query=${encodeURIComponent(searchQuery)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSearchResults(response.data);
    } catch (error) {
      setMessage('검색에 실패했습니다');
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (friendId) => {
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/friends/${friendId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('친구 추가되었습니다');
      fetchFriends();
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      setMessage(error.response?.data?.detail || '친구 추가에 실패했습니다');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm('정말 친구를 삭제하시겠습니까?')) return;

    setMessage('');

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/friends/${friendId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('친구가 삭제되었습니다');
      fetchFriends();
    } catch (error) {
      setMessage('친구 삭제에 실패했습니다');
    }
  };

  const isFriend = (userId) => {
    return friends.some(f => f.id === userId);
  };

  const handleViewProfile = async (friendId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [userRes, statsRes, solvedRes, createdRes] = await Promise.all([
        axios.get(`${API_URL}/users/${friendId}`, { headers }),
        axios.get(`${API_URL}/api/profile/${friendId}/stats`, { headers }),
        axios.get(`${API_URL}/api/profile/${friendId}/solved`, { headers }),
        axios.get(`${API_URL}/api/problems?creator_id=${friendId}`, { headers })
      ]);

      setFriendProfile({
        user: userRes.data,
        stats: statsRes.data,
        solvedProblems: solvedRes.data,
        createdProblems: createdRes.data
      });
      setSelectedFriend(friendId);
    } catch (error) {
      console.error('Failed to fetch friend profile:', error);
      setMessage('프로필을 불러오는데 실패했습니다');
    }
  };

  const closeProfileModal = () => {
    setSelectedFriend(null);
    setFriendProfile(null);
  };

  if (loading) {
    return (
      <div className="friends-page">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="friends-page">
      <div className="friends-container">
        <div className="friends-header">
          <h1>친구</h1>
          <p>{friends.length}명의 친구</p>
        </div>

        <div className="search-section">
          <h2>친구 찾기</h2>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              className="search-input"
              placeholder="아이디 또는 닉네임으로 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={searching}>
              {searching ? '검색 중...' : '검색'}
            </button>
          </form>

          {message && (
            <div className={`message ${message.includes('실패') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="search-results">
              <h3>검색 결과</h3>
              <div className="users-list">
                {searchResults.map((searchUser) => (
                  <div key={searchUser.id} className="user-card">
                    <div className="user-info">
                      {searchUser.profile_image_url && (
                        <img
                          src={searchUser.profile_image_url}
                          alt="프로필"
                          className="user-avatar"
                        />
                      )}
                      <div className="user-details">
                        <div className="user-name">
                          {searchUser.nickname || searchUser.username}
                        </div>
                        <div className="user-username">@{searchUser.username}</div>
                        {searchUser.bio && (
                          <div className="user-bio">{searchUser.bio}</div>
                        )}
                      </div>
                    </div>
                    {searchUser.id !== user?.id && (
                      <button
                        className={`btn ${isFriend(searchUser.id) ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() =>
                          isFriend(searchUser.id)
                            ? handleRemoveFriend(searchUser.id)
                            : handleAddFriend(searchUser.id)
                        }
                      >
                        {isFriend(searchUser.id) ? '친구 삭제' : '친구 추가'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="friends-list-section">
          <h2>친구 목록</h2>
          {friends.length > 0 ? (
            <div className="users-list">
              {friends.map((friend) => (
                <div key={friend.id} className="user-card">
                  <div className="user-info">
                    {friend.profile_image_url && (
                      <img
                        src={friend.profile_image_url}
                        alt="프로필"
                        className="user-avatar"
                      />
                    )}
                    <div className="user-details">
                      <div className="user-name">
                        {friend.nickname || friend.username}
                      </div>
                      <div className="user-username">@{friend.username}</div>
                      {friend.bio && (
                        <div className="user-bio">{friend.bio}</div>
                      )}
                      {friend.favorite_algorithms && friend.favorite_algorithms.length > 0 && (
                        <div className="user-algorithms">
                          {friend.favorite_algorithms.map((algo, i) => (
                            <span key={i} className="algo-tag">{algo}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="friend-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => handleViewProfile(friend.id)}
                    >
                      프로필 보기
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleRemoveFriend(friend.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>아직 친구가 없습니다</p>
              <p>위에서 친구를 검색하여 추가해보세요</p>
            </div>
          )}
        </div>
      </div>

      {selectedFriend && friendProfile && (
        <div className="profile-modal-overlay" onClick={closeProfileModal}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeProfileModal}>✕</button>

            <div
              className={`modal-profile-header ${friendProfile.user.profile_background_url ? 'with-background' : ''}`}
              style={friendProfile.user.profile_background_url ? { '--bg-image': `url(${friendProfile.user.profile_background_url})` } : {}}
            >
              <div className="modal-profile-left">
                {friendProfile.user.profile_image_url ? (
                  <img src={friendProfile.user.profile_image_url} alt="프로필" className="modal-profile-image" />
                ) : (
                  <div className="modal-profile-image-placeholder">
                    {(friendProfile.user.nickname || friendProfile.user.username)?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="modal-profile-info">
                  <h1>{friendProfile.user.nickname || friendProfile.user.username}</h1>
                  {friendProfile.user.bio && <p className="modal-profile-bio">{friendProfile.user.bio}</p>}
                  {friendProfile.user.favorite_algorithms && friendProfile.user.favorite_algorithms.length > 0 && (
                    <div className="modal-profile-algorithms">
                      {friendProfile.user.favorite_algorithms.map((algo, i) => (
                        <span key={i} className="modal-algo-badge">{algo}</span>
                      ))}
                    </div>
                  )}
                  <div className="modal-profile-links">
                    {friendProfile.user.external_link_1 && (
                      <a href={friendProfile.user.external_link_1} target="_blank" rel="noopener noreferrer" className="modal-external-link">
                        🔗 {new URL(friendProfile.user.external_link_1).hostname}
                      </a>
                    )}
                    {friendProfile.user.external_link_2 && (
                      <a href={friendProfile.user.external_link_2} target="_blank" rel="noopener noreferrer" className="modal-external-link">
                        🔗 {new URL(friendProfile.user.external_link_2).hostname}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-profile-stats-container">
                <h3>통계</h3>
                <div className="modal-stats-grid">
                  <div className="modal-stat-card">
                    <div className="modal-stat-value">{friendProfile.stats.solved_count}</div>
                    <div className="modal-stat-label">해결한 문제</div>
                  </div>
                  <div className="modal-stat-card">
                    <div className="modal-stat-value">{friendProfile.stats.attempt_count}</div>
                    <div className="modal-stat-label">제출 횟수</div>
                  </div>
                  <div className="modal-stat-card">
                    <div className="modal-stat-value">{(friendProfile.stats.accuracy_rate || 0).toFixed(1)}%</div>
                    <div className="modal-stat-label">정답률</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-problems-section">
              <h2>최근 해결한 문제</h2>
              {friendProfile.solvedProblems.length > 0 ? (
                <div className="modal-problems-list">
                  {friendProfile.solvedProblems.slice(0, 5).map((problem) => (
                    <Link
                      key={problem.id}
                      to={`/problems/${problem.id}`}
                      className="modal-problem-item"
                      onClick={closeProfileModal}
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
              {friendProfile.createdProblems.length > 0 ? (
                <div className="modal-problems-list">
                  {friendProfile.createdProblems.slice(0, 5).map((problem) => (
                    <Link
                      key={problem.id}
                      to={`/problems/${problem.id}`}
                      className="modal-problem-item"
                      onClick={closeProfileModal}
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

export default Friends;
