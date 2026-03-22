import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import AdminDashboard from './AdminDashboard'
import MemberDashboard from './MemberDashboard'
import logo from './assets/logo.png'

const MEMBER_STORAGE_KEY = 'thefitness_hwajeong_member_session_v1'

function BrandHeader({ large = false }) {
  return (
    <div className={`brand-header ${large ? 'large' : ''}`}>
      <img
        src={logo}
        alt="더피트니스 화정점 로고"
        className={`brand-logo ${large ? 'large' : ''}`}
      />
      <div className="brand-header-text">
        <div className="brand-mark">더피트니스 화정점</div>
        {large ? (
          <div className="brand-caption">
            회원관리 · 운동기록 · 식단기록 · 건강정보
          </div>
        ) : null}
      </div>
    </div>
  )
}

function AdminLogin({ onLogin, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message || '로그인에 실패했습니다.')
      setLoading(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) {
      setMessage('사용자 정보를 불러오지 못했습니다.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile || profile.role !== 'admin') {
      await supabase.auth.signOut()
      setMessage('관리자 계정만 접근할 수 있습니다.')
      setLoading(false)
      return
    }

    onLogin(profile)
    setLoading(false)
  }

  return (
    <div className="auth-card auth-card-large">
      <BrandHeader large />
      <h1>관리자 로그인</h1>
      <p className="sub-text">더피트니스 화정점 관리자 계정으로 로그인하세요.</p>

      <form onSubmit={handleLogin} className="stack-gap">
        <label className="field">
          <span>이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@email.com"
          />
        </label>

        <label className="field">
          <span>비밀번호</span>
          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
            />
            <button
              type="button"
              className="toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? '숨김' : '보기'}
            </button>
          </div>
        </label>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? '로그인 중...' : '관리자 로그인'}
        </button>

        <button type="button" className="secondary-btn" onClick={onBack}>
          돌아가기
        </button>

        {message ? <div className="message error">{message}</div> : null}
      </form>
    </div>
  )
}

function MemberAccess({ initialMemberId, onSuccess, onBack }) {
  const [memberId, setMemberId] = useState(initialMemberId || '')
  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAccess = async (e) => {
    e.preventDefault()

    if (!memberId.trim() || !accessCode.trim()) {
      setMessage('회원 ID와 access code를 입력해주세요.')
      return
    }

    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.rpc('get_member_by_code', {
      member_uuid: memberId,
      code: accessCode.trim(),
    })

    if (error || !data || data.length === 0) {
      setMessage('회원 확인에 실패했습니다. ID 또는 access code를 다시 확인해주세요.')
      setLoading(false)
      return
    }

    const sessionData = {
      member: data[0],
      accessCode: accessCode.trim(),
    }

    localStorage.setItem(MEMBER_STORAGE_KEY, JSON.stringify(sessionData))
    onSuccess(sessionData)
    setLoading(false)
  }

  return (
    <div className="auth-card auth-card-large">
      <BrandHeader large />
      <h1>회원 입장</h1>
      <p className="sub-text">회원 전용 링크의 member 값과 access code를 입력하세요.</p>

      <form onSubmit={handleAccess} className="stack-gap">
        <label className="field">
          <span>회원 ID</span>
          <input
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="URL의 ?member= 뒤 값"
          />
        </label>

        <label className="field">
          <span>Access Code</span>
          <input
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
            placeholder="예: TF2026A1"
          />
        </label>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? '확인 중...' : '회원 입장'}
        </button>

        <button type="button" className="secondary-btn" onClick={onBack}>
          돌아가기
        </button>

        {message ? <div className="message error">{message}</div> : null}
      </form>
    </div>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('home')
  const [adminProfile, setAdminProfile] = useState(null)
  const [memberSession, setMemberSession] = useState(null)

  const initialMemberId = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('member') || ''
  }, [])

  useEffect(() => {
    let cancelled = false

    const restore = async () => {
      try {
        const savedMember = localStorage.getItem(MEMBER_STORAGE_KEY)

        if (savedMember) {
          try {
            const parsed = JSON.parse(savedMember)
            if (parsed?.member?.id && parsed?.accessCode) {
              if (!cancelled) {
                setMemberSession(parsed)
                setMode('member')
                setLoading(false)
              }
              return
            }
          } catch {
            localStorage.removeItem(MEMBER_STORAGE_KEY)
          }
        }

        const { data, error } = await supabase.auth.getSession()

        if (error) {
          if (!cancelled) {
            setMode(initialMemberId ? 'member-access' : 'home')
            setLoading(false)
          }
          return
        }

        const session = data?.session

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (!cancelled && profile?.role === 'admin') {
            setAdminProfile(profile)
            setMode('admin')
            setLoading(false)
            return
          }
        }

        if (!cancelled) {
          setMode(initialMemberId ? 'member-access' : 'home')
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setMode(initialMemberId ? 'member-access' : 'home')
          setLoading(false)
        }
      }
    }

    restore()

    return () => {
      cancelled = true
    }
  }, [initialMemberId])

  const handleAdminLogout = async () => {
    await supabase.auth.signOut()
    setAdminProfile(null)
    setMode(initialMemberId ? 'member-access' : 'home')
  }

  const handleMemberLogout = () => {
    localStorage.removeItem(MEMBER_STORAGE_KEY)
    setMemberSession(null)
    setMode(initialMemberId ? 'member-access' : 'home')
  }

  if (loading) {
    return (
      <div className="app-shell center-screen">
        <div className="loading-card">로딩 중...</div>
      </div>
    )
  }

  if (mode === 'admin' && adminProfile) {
    return (
      <div className="app-shell">
        <AdminDashboard profile={adminProfile} onLogout={handleAdminLogout} />
      </div>
    )
  }

  if (mode === 'member' && memberSession) {
    return (
      <div className="app-shell">
        <MemberDashboard
          member={memberSession.member}
          accessCode={memberSession.accessCode}
          onLogout={handleMemberLogout}
        />
      </div>
    )
  }

  if (mode === 'admin-login') {
    return (
      <div className="app-shell center-screen">
        <AdminLogin
          onLogin={(profile) => {
            setAdminProfile(profile)
            setMode('admin')
          }}
          onBack={() => setMode('home')}
        />
      </div>
    )
  }

  if (mode === 'member-access') {
    return (
      <div className="app-shell center-screen">
        <MemberAccess
          initialMemberId={initialMemberId}
          onSuccess={(sessionData) => {
            setMemberSession(sessionData)
            setMode('member')
          }}
          onBack={() => setMode('home')}
        />
      </div>
    )
  }

  return (
    <div className="app-shell center-screen">
      <div className="choice-grid">
        <div className="auth-card auth-card-large">
          <BrandHeader large />
          <h1>시작하기</h1>
          <p className="sub-text">관리자 또는 회원으로 입장할 수 있습니다.</p>

          <div className="stack-gap">
            <button className="primary-btn" onClick={() => setMode('admin-login')}>
              관리자 입장
            </button>
            <button className="secondary-btn" onClick={() => setMode('member-access')}>
              회원 입장
            </button>
          </div>
        </div>

        <div className="info-card">
          <h2>입장 안내</h2>
          <ul className="info-list">
            <li>관리자: 이메일 / 비밀번호 로그인</li>
            <li>회원: URL의 member 값 + access code</li>
            <li>새로고침 시 세션 유지</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
