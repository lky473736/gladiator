import { useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import LoginModal from './LoginModal';
import RegisterModal from './RegisterModal';
import '../styles/Navbar.css';

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // 디버깅: 모달 상태 변경 감지
  console.log('Navbar render - showLoginModal:', showLoginModal, 'showRegisterModal:', showRegisterModal);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-logo">
            Gladiator
          </Link>

          <ul className="navbar-menu">
            <li>
              <Link to="/" className={`navbar-link ${isActive('/')}`}>
                홈
              </Link>
            </li>
            <li>
              <Link to="/problems" className={`navbar-link ${isActive('/problems')}`}>
                문제 풀기
              </Link>
            </li>
            {user && (
              <>
                <li>
                  <Link to="/create-problem" className={`navbar-link ${isActive('/create-problem')}`}>
                    문제 만들기
                  </Link>
                </li>
                <li>
                  <Link to="/friends" className={`navbar-link ${isActive('/friends')}`}>
                    친구
                  </Link>
                </li>
                <li>
                  <Link to="/settings" className={`navbar-link ${isActive('/settings')}`}>
                    프로필 설정
                  </Link>
                </li>
              </>
            )}
          </ul>

          <div className="navbar-user">
            {user ? (
              <>
                <span className="navbar-username">{user?.nickname || user?.username}</span>
                <button onClick={handleLogout} className="logout-btn">로그아웃</button>
              </>
            ) : (
              <>
                <button onClick={() => { console.log('로그인 버튼 클릭'); setShowLoginModal(true); }} className="login-btn">로그인</button>
                <button onClick={() => { console.log('회원가입 버튼 클릭'); setShowRegisterModal(true); }} className="register-btn">회원가입</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {showLoginModal && createPortal(
        <LoginModal
          onClose={() => {
            console.log('로그인 모달 닫기');
            setShowLoginModal(false);
          }}
          onSwitchToRegister={() => {
            console.log('회원가입으로 전환');
            setShowLoginModal(false);
            setShowRegisterModal(true);
          }}
        />,
        document.body
      )}
      {showRegisterModal && createPortal(
        <RegisterModal
          onClose={() => {
            console.log('회원가입 모달 닫기');
            setShowRegisterModal(false);
          }}
          onSwitchToLogin={() => {
            console.log('로그인으로 전환');
            setShowRegisterModal(false);
            setShowLoginModal(true);
          }}
        />,
        document.body
      )}
    </>
  );
}

export default Navbar;
