import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Problems from './pages/Problems';
import ProblemDetail from './pages/ProblemDetail';
import CreateProblem from './pages/CreateProblem';
import Friends from './pages/Friends';
import ProfileSettings from './pages/ProfileSettings';

// Components
import Navbar from './components/Navbar';

// Context
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
          <Route path="/problems" element={<PublicRoute><Problems /></PublicRoute>} />
          <Route path="/problems/:id" element={<ProtectedRoute><ProblemDetail /></ProtectedRoute>} />
          <Route path="/create-problem" element={<ProtectedRoute><CreateProblem /></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

// 로그인 필요한 페이지
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

// 로그인 없이도 접근 가능한 페이지
function PublicRoute({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

export default App;
