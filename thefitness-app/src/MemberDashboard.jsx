import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import './style.css'

const memberTabs = ['내정보', '저장된 운동기록', '개인운동입력', '루틴', '사용방법']

function groupWorkoutItems(items = []) {
  const map = new Map()

  items.forEach((row) => {
    const key = [
      row.exercise_name || '',
      row.body_part || '',
      row.category || '',
      row.brand || '',
      row.good_point || '',
      row.improve_point || '',
    ].join('||')

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        exerciseName: row.exercise_name || '',
        bodyPart: row.body_part || '',
        category: row.category || '',
        brand: row.brand || '',
        goodPoint: row.good_point || '',
        improvePoint: row.improve_point || '',
        sets: [],
      })
    }

    map.get(key).sets.push({
      id: row.id || `${key}-${row.set_no}`,
      setNo: Number(row.set_no || 0),
      kg: Number(row.kg || 0),
      reps: Number(row.reps || 0),
    })
  })

  return Array.from(map.values()).map((item) => ({
    ...item,
    sets: [...item.sets].sort((a, b) => a.setNo - b.setNo),
  }))
}

function getTodayKST() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function summarizeWorkout(workout) {
  const items = groupWorkoutItems(workout.workout_items || [])
  const exerciseCount = items.length
  const totalSets = items.reduce((sum, item) => sum + item.sets.length, 0)

  return {
    exerciseCount,
    totalSets,
    items,
  }
}

export default function MemberDashboard({ member, accessCode }) {
  const [activeTab, setActiveTab] = useState('내정보')
  const [workoutHistory, setWorkoutHistory] = useState([])
  const [expandedWorkoutIds, setExpandedWorkoutIds] = useState([])
  const [routineRows, setRoutineRows] = useState([])
  const [manual, setManual] = useState({
    title: '더피트니스 화정점 사용방법',
    content: '',
  })
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingRoutine, setLoadingRoutine] = useState(true)
  const [loadingManual, setLoadingManual] = useState(true)
  const [savingSelfWorkout, setSavingSelfWorkout] = useState(false)

  const [selfWorkoutForm, setSelfWorkoutForm] = useState({
    workout_date: getTodayKST(),
    body_parts_text: '',
    memo: '',
  })

  const remainingSessions = Math.max(
    Number(member.total_sessions || 0) - Number(member.used_sessions || 0),
    0
  )

  const progress = Math.round(
    (Number(member.used_sessions || 0) / Math.max(Number(member.total_sessions || 1), 1)) * 100
  )

  const loadWorkoutHistory = async () => {
    setLoadingHistory(true)

    const { data, error } = await supabase
      .from('workouts')
      .select(`
        *,
        workout_items (*)
      `)
      .eq('member_id', member.id)
      .order('workout_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      alert(`기록 불러오기 오류: ${error.message}`)
      setLoadingHistory(false)
      return
    }

    setWorkoutHistory(data || [])
    setLoadingHistory(false)
  }

  const loadRoutines = async () => {
    setLoadingRoutine(true)

    const { data, error } = await supabase
      .from('member_routines')
      .select('*')
      .eq('member_id', member.id)
      .order('sort_order', { ascending: true })

    if (error) {
      alert(`루틴 불러오기 오류: ${error.message}`)
      setLoadingRoutine(false)
      return
    }

    setRoutineRows(data || [])
    setLoadingRoutine(false)
  }

  const loadManual = async () => {
    setLoadingManual(true)

    const { data, error } = await supabase
      .from('app_manuals')
      .select('*')
      .eq('manual_key', 'common')
      .maybeSingle()

    if (error) {
      alert(`사용방법 불러오기 오류: ${error.message}`)
      setLoadingManual(false)
      return
    }

    setManual({
      title: data?.title || '더피트니스 화정점 사용방법',
      content: data?.content || '',
    })
    setLoadingManual(false)
  }

  useEffect(() => {
    loadWorkoutHistory()
    loadRoutines()
    loadManual()
    setExpandedWorkoutIds([])
    setActiveTab('내정보')
  }, [member.id])

  const monthlyStats = useMemo(() => {
    const monthKey = getTodayKST().slice(0, 7)
    const currentMonthRows = workoutHistory.filter(
      (row) => (row.workout_date || '').slice(0, 7) === monthKey
    )

    return {
      total: currentMonthRows.length,
      pt: currentMonthRows.filter((row) => (row.workout_type || 'pt') === 'pt').length,
      self: currentMonthRows.filter((row) => (row.workout_type || 'pt') === 'self').length,
    }
  }, [workoutHistory])

  const toggleWorkout = (workoutId) => {
    setExpandedWorkoutIds((prev) =>
      prev.includes(workoutId)
        ? prev.filter((id) => id !== workoutId)
        : [...prev, workoutId]
    )
  }

  const saveSelfWorkout = async () => {
    if (!selfWorkoutForm.workout_date) {
      alert('날짜를 입력해 주세요.')
      return
    }

    setSavingSelfWorkout(true)

    const bodyParts = selfWorkoutForm.body_parts_text
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    const { error } = await supabase.from('workouts').insert([
      {
        member_id: member.id,
        workout_date: selfWorkoutForm.workout_date,
        body_parts: bodyParts,
        workout_type: 'self',
      },
    ])

    if (error) {
      alert(`개인운동 저장 오류: ${error.message}`)
      setSavingSelfWorkout(false)
      return
    }

    alert('개인운동 기록 저장 완료')

    setSelfWorkoutForm({
      workout_date: getTodayKST(),
      body_parts_text: '',
      memo: '',
    })

    await loadWorkoutHistory()
    setActiveTab('저장된 운동기록')
    setSavingSelfWorkout(false)
  }

  const ptHistory = workoutHistory.filter((row) => (row.workout_type || 'pt') === 'pt')
  const selfHistory = workoutHistory.filter((row) => (row.workout_type || 'pt') === 'self')

  return (
    <div className="dashboard-shell member-shell">
      <div className="dashboard-topbar">
        <div>
          <h2 style={{ margin: 0 }}>회원 전용 화면</h2>
          <div className="muted">
            더피트니스 화정점 · {member.name}님
          </div>
        </div>
        <div className="pill">입장코드: {accessCode}</div>
      </div>

      <div className="tab-bar">
        {memberTabs.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === '내정보' && (
        <div className="tab-page">
          <section className="card section-card">
            <div className="section-head">
              <div>
                <div className="section-label">회원 정보</div>
                <h2>{member.name}</h2>
              </div>
              <div className="pill">남은 세션 {remainingSessions}회</div>
            </div>

            <div className="summary-grid">
              <div className="summary-box">
                <div className="summary-label">목표</div>
                <div className="summary-value">{member.goal || '미입력'}</div>
              </div>
              <div className="summary-box">
                <div className="summary-label">세션</div>
                <div className="summary-value">
                  {member.used_sessions} / {member.total_sessions}회
                </div>
              </div>
              <div className="summary-box">
                <div className="summary-label">이번달 PT</div>
                <div className="summary-value">{monthlyStats.pt}회</div>
              </div>
              <div className="summary-box">
                <div className="summary-label">이번달 개인운동</div>
                <div className="summary-value">{monthlyStats.self}회</div>
              </div>
            </div>

            <div className="progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-box">
                <div className="summary-label">시작일</div>
                <div className="summary-value">{member.start_date || '-'}</div>
              </div>
              <div className="summary-box">
                <div className="summary-label">종료일</div>
                <div className="summary-value">{member.end_date || '-'}</div>
              </div>
              <div className="summary-box">
                <div className="summary-label">이번달 총 운동</div>
                <div className="summary-value">{monthlyStats.total}회</div>
              </div>
              <div className="summary-box">
                <div className="summary-label">남은 세션</div>
                <div className="summary-value">{remainingSessions}회</div>
              </div>
            </div>

            <div className="memo-box">
              <div className="memo-title">메모</div>
              <div>{member.memo || '등록된 메모가 없습니다.'}</div>
            </div>
          </section>
        </div>
      )}

      {activeTab === '저장된 운동기록' && (
        <div className="tab-page">
          <section className="card section-card">
            <div className="section-head">
              <div>
                <div className="section-label">저장된 운동 기록</div>
                <h2>간추려보기 / 상세히 보기</h2>
              </div>
              <div className="muted">
                PT {ptHistory.length}건 / 개인운동 {selfHistory.length}건
              </div>
            </div>

            {loadingHistory ? (
              <div className="muted">기록 불러오는 중...</div>
            ) : workoutHistory.length === 0 ? (
              <div className="muted">아직 저장된 운동 기록이 없습니다.</div>
            ) : (
              <div className="record-list">
                {workoutHistory.map((workout) => {
                  const { exerciseCount, totalSets, items } = summarizeWorkout(workout)
                  const isExpanded = expandedWorkoutIds.includes(workout.id)

                  return (
                    <div className="record-card" key={workout.id}>
                      <div className="record-card-top">
                        <div>
                          <div className="record-date">{workout.workout_date}</div>
                          <div className="record-meta">
                            구분: {(workout.workout_type || 'pt') === 'self' ? '개인운동' : 'PT'} · 부위:{' '}
                            {(workout.body_parts || []).join(', ') || '-'}
                          </div>
                        </div>

                        <div className="button-row">
                          <button
                            className="secondary-btn"
                            onClick={() => toggleWorkout(workout.id)}
                          >
                            {isExpanded ? '간추려보기' : '상세히 보기'}
                          </button>
                        </div>
                      </div>

                      <div className="record-summary-grid">
                        <div className="record-summary-box">
                          <div className="summary-label">운동 개수</div>
                          <div className="summary-value">{exerciseCount}개</div>
                        </div>
                        <div className="record-summary-box">
                          <div className="summary-label">총 세트</div>
                          <div className="summary-value">{totalSets}세트</div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="record-detail-list">
                          {(workout.workout_type || 'pt') === 'self' && items.length === 0 ? (
                            <div className="memo-box">
                              <div className="memo-title">개인운동 기록</div>
                              <div>
                                등록 부위: {(workout.body_parts || []).join(', ') || '-'}
                              </div>
                            </div>
                          ) : items.length === 0 ? (
                            <div className="muted">상세 운동 항목이 없습니다.</div>
                          ) : (
                            items.map((item) => (
                              <div key={item.id} className="record-detail-card">
                                <div className="record-detail-title">{item.exerciseName}</div>

                                <div className="tag-row" style={{ marginTop: 8 }}>
                                  <span className="tag">{item.bodyPart || '-'}</span>
                                  <span className="tag">{item.category || '-'}</span>
                                  <span className="tag">{item.brand || '-'}</span>
                                </div>

                                <div className="history-sets" style={{ marginTop: 10 }}>
                                  {item.sets.map((setRow) => (
                                    <span key={setRow.id} className="tag">
                                      {setRow.setNo}세트 · {setRow.kg}kg · {setRow.reps}회
                                    </span>
                                  ))}
                                </div>

                                {(item.goodPoint || item.improvePoint) && (
                                  <div className="member-feedback-grid" style={{ marginTop: 12 }}>
                                    <div className="feedback good">
                                      <div className="memo-title">잘한 점</div>
                                      <div>{item.goodPoint || '-'}</div>
                                    </div>
                                    <div className="feedback warn">
                                      <div className="memo-title">보완할 점</div>
                                      <div>{item.improvePoint || '-'}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === '개인운동입력' && (
        <div className="tab-page">
          <section className="card section-card">
            <div className="section-head">
              <div>
                <div className="section-label">개인운동 입력</div>
                <h2>직접 기록하기</h2>
              </div>
            </div>

            <div className="form-block">
              <input
                type="date"
                value={selfWorkoutForm.workout_date}
                onChange={(e) =>
                  setSelfWorkoutForm((prev) => ({
                    ...prev,
                    workout_date: e.target.value,
                  }))
                }
              />

              <input
                placeholder="운동 부위 입력 (예: 등, 하체, 유산소)"
                value={selfWorkoutForm.body_parts_text}
                onChange={(e) =>
                  setSelfWorkoutForm((prev) => ({
                    ...prev,
                    body_parts_text: e.target.value,
                  }))
                }
              />

              <textarea
                placeholder="메모 (선택)"
                value={selfWorkoutForm.memo}
                onChange={(e) =>
                  setSelfWorkoutForm((prev) => ({
                    ...prev,
                    memo: e.target.value,
                  }))
                }
              />

              <button
                className="primary-btn"
                onClick={saveSelfWorkout}
                disabled={savingSelfWorkout}
              >
                {savingSelfWorkout ? '저장 중...' : '개인운동 저장'}
              </button>
            </div>

            <div className="memo-box" style={{ marginTop: 16 }}>
              <div className="memo-title">안내</div>
              <div>
                개인운동 입력은 횟수 체크용입니다.
                PT 세션 차감은 관리자 기록 작성 기준으로 반영됩니다.
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === '루틴' && (
        <div className="tab-page">
          <section className="card section-card">
            <div className="section-head">
              <div>
                <div className="section-label">내 루틴</div>
                <h2>요일별 운동 루틴</h2>
              </div>
            </div>

            {loadingRoutine ? (
              <div className="muted">루틴 불러오는 중...</div>
            ) : routineRows.length === 0 ? (
              <div className="muted">등록된 루틴이 없습니다.</div>
            ) : (
              <div className="routine-list">
                {routineRows.map((row) => (
                  <div className="routine-card modern-card" key={row.id}>
                    <div className="routine-day">{row.day_label}</div>
                    <div className="routine-title">{row.title || '루틴 제목 없음'}</div>

                    {Array.isArray(row.exercises) && row.exercises.length > 0 ? (
                      <ul className="routine-ul">
                        {row.exercises.map((exercise, index) => (
                          <li key={`${row.id}-${index}`}>{exercise}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="muted">운동 목록이 없습니다.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === '사용방법' && (
        <div className="tab-page">
          <section className="card section-card">
            <div className="section-head">
              <div>
                <div className="section-label">사용방법</div>
                <h2>{manual.title || '더피트니스 화정점 사용방법'}</h2>
              </div>
              {loadingManual && <div className="muted">불러오는 중...</div>}
            </div>

            <div className="manual-view">
              {manual.content ? (
                manual.content.split('\n').map((line, index) => (
                  <p key={index}>{line || '\u00A0'}</p>
                ))
              ) : (
                <div className="muted">등록된 사용방법이 없습니다.</div>
              )}
            </div>
          </section>
        </div>
      )}

      <div className="bottom-tab-bar">
        {memberTabs.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  )
}
