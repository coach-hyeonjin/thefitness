import { useMemo, useState } from 'react'
import { supabase } from './supabase'
import AdminDashboard from './AdminDashboard'
import MemberDashboard from './MemberDashboard'
import './style.css'
import logo from './assets/logo.png'

function AdminLogin({ onAdminLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage('이메일과 비밀번호를 입력해 주세요.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        if (error.message?.toLowerCase().includes('invalid login credentials')) {
          setMessage('로그인 오류: 이메일 또는 비밀번호가 올바르지 않습니다.')
        } else {
          setMessage(`로그인 오류: ${error.message}`)
        }
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError) {
        setMessage(`프로필 조회 오류: ${profileError.message}`)
        return
      }

      if (!profileData || profileData.role !== 'admin') {
        setMessage('관리자 계정이 아닙니다.')
        await supabase.auth.signOut()
        return
      }

      onAdminLogin(data.user, profileData)
    } catch (e) {
      setMessage(`로그인 오류: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="entry-card">
      <h2>관리자 로그인</h2>
      <p className="muted">더피트니스 화정점 관리자 전용 화면입니다.</p>

      <input
        className="app-input"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="username"
      />

      <div className="password-wrap">
        <input
          className="app-input"
          type={showPassword ? 'text' : 'password'}
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="current-password"
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShowPassword((prev) => !prev)}
        >
          {showPassword ? '숨기기' : '보기'}
        </button>
      </div>

      <button
        className="primary-btn full-btn"
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? '로그인 중...' : '관리자 로그인'}
      </button>

      {message && <p className="error-text">{message}</p>}
    </div>
  )
}

function MemberEntry({ memberIdFromUrl = '' }) {
  const [memberId, setMemberId] = useState(memberIdFromUrl)
  const [code, setCode] = useState('')
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleEnter = async () => {
    if (!memberId.trim() || !code.trim()) {
      setMessage('회원 전용 링크와 코드를 확인해 주세요.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.rpc('get_member_by_code', {
        p_member_id: memberId.trim(),
        p_code: code.trim().toUpperCase(),
      })

      if (error) {
        setMessage(`입장 오류: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        setMessage('코드가 일치하지 않습니다.')
        return
      }

      setMember(data[0])
    } catch (e) {
      setMessage(`입장 오류: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleEnter()
  }

  if (member) {
    return <MemberDashboard member={member} accessCode={code.trim().toUpperCase()} />
  }

  return (
    <div className="entry-card">
      <h2>회원 전용 입장</h2>
      <p className="muted">관리자에게 받은 전용 링크와 코드를 입력해 주세요.</p>

      {!memberIdFromUrl && (
        <input
          className="app-input"
          placeholder="회원 ID 또는 링크의 member 값"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      )}

      {memberIdFromUrl && (
        <div className="member-link-box" style={{ marginBottom: 12 }}>
          <div className="memo-title">회원 링크 확인됨</div>
          <div className="muted">코드만 입력하면 입장할 수 있습니다.</div>
        </div>
      )}

      <input
        className="app-input"
        placeholder="입장 코드"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
      />

      <button
        className="secondary-btn full-btn"
        onClick={handleEnter}
        disabled={loading}
      >
        {loading ? '확인 중...' : '회원 전용 입장'}
      </button>

      {message && <p className="error-text">{message}</p>}
    </div>
  )
}

export default function App() {
  const [adminUser, setAdminUser] = useState(null)
  const [adminProfile, setAdminProfile] = useState(null)

  const memberIdFromUrl = useMemo(() => {
    return new URLSearchParams(window.location.search).get('member') || ''
  }, [])

  const handleAdminLogin = (user, profile) => {
    setAdminUser(user)
    setAdminProfile(profile)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setAdminUser(null)
    setAdminProfile(null)
    window.location.href = window.location.origin
  }

  if (adminUser && adminProfile) {
    return (
      <AdminDashboard
        user={adminUser}
        profile={adminProfile}
        onLogout={handleLogout}
      />
    )
  }

  if (memberIdFromUrl) {
    return (
      <div className="entry-shell">
        <div className="entry-header">
          <img src={logo} alt="더피트니스 화정점 로고" className="main-logo" />
          <h1>더피트니스 화정점</h1>
          <p>회원 전용 링크로 접속했습니다. 입장 코드를 입력해 주세요.</p>
        </div>

        <div className="entry-grid single">
          <MemberEntry memberIdFromUrl={memberIdFromUrl} />
        </div>
      </div>
    )
  }

  return (
    <div className="entry-shell">
      <div className="entry-header">
        <img src={logo} alt="더피트니스 화정점 로고" className="main-logo" />
        <h1>더피트니스 화정점</h1>
        <p>관리자용 회원 관리 화면과 회원 전용 확인 화면을 분리한 버전입니다.</p>
      </div>

      <div className="entry-grid">
        <AdminLogin onAdminLogin={handleAdminLogin} />
        <MemberEntry />
      </div>
    </div>
  )
}
