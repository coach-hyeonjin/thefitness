import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import './style.css'

const memberTabs = ['내정보', '저장된 운동기록', '개인운동입력', '루틴', '사용방법']
const bodyPartOptions = ['가슴', '어깨', '팔', '등', '하체', '스트레칭&재활', '유산소']
const categoryOptions = ['웨이트', '유산소', '스트레칭&재활']

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

function createSelfWorkoutItem(defaultBrand = '기본') {
  return {
    id: `self-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: '웨이트',
    bodyPart: '등',
    brand: defaultBrand,
    exerciseName: '',
    sets: [{ setNo: 1, kg: 0, reps: 0 }],
    goodPoint: '',
    improvePoint: '',
  }
}

function normalizeSetNumbers(sets = []) {
  return sets.map((setRow, index) => ({
    ...setRow,
    setNo: index + 1,
  }))
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
  const [exercises, setExercises] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingRoutine, setLoadingRoutine] = useState(true)
  const [loadingManual, setLoadingManual] = useState(true)
  const [loadingExercises, setLoadingExercises] = useState(true)
  const [savingSelfWorkout, setSavingSelfWorkout] = useState(false)

  const [selfWorkoutForm, setSelfWorkoutForm] = useState({
    workout_date: getTodayKST(),
    bodyParts: [],
    items: [createSelfWorkoutItem('기본')],
  })

  const remainingSessions = Math.max(
    Number(member.total_sessions || 0) - Number(member.used_sessions || 0),
    0
  )

  const progress = Math.round(
    (Number(member.used_sessions || 0) / Math.max(Number(member.total_sessions || 1), 1)) * 100
  )

  const brandNames = useMemo(() => {
    const names = [...new Set((exercises || []).map((e) => e.brand_name).filter(Boolean))]
    return names.length > 0 ? names : ['기본']
  }, [exercises])

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

  const loadExercises = async () => {
    setLoadingExercises(true)

    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      alert(`운동DB 불러오기 오류: ${error.message}`)
      setLoadingExercises(false)
      return
    }

    setExercises(data || [])
    setLoadingExercises(false)
  }

  useEffect(() => {
    loadWorkoutHistory()
    loadRoutines()
    loadManual()
    loadExercises()
    setExpandedWorkoutIds([])
    setActiveTab('내정보')
  }, [member.id])

  useEffect(() => {
    const defaultBrand = brandNames[0] || '기본'
    setSelfWorkoutForm((prev) => ({
      ...prev,
      items:
        prev.items && prev.items.length > 0
          ? prev.items.map((item) => ({
              ...item,
              brand: item.brand || defaultBrand,
            }))
          : [createSelfWorkoutItem(defaultBrand)],
    }))
  }, [brandNames])

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

  const toggleSelfBodyPart = (part) => {
    setSelfWorkoutForm((prev) => ({
      ...prev,
      bodyParts: prev.bodyParts.includes(part)
        ? prev.bodyParts.filter((p) => p !== part)
        : [...prev.bodyParts, part],
    }))
  }

  const updateSelfWorkoutItem = (index, patch) => {
    setSelfWorkoutForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const addSelfWorkoutItem = () => {
    setSelfWorkoutForm((prev) => ({
      ...prev,
      items: [...prev.items, createSelfWorkoutItem(brandNames[0] || '기본')],
    }))
  }

  const removeSelfWorkoutItem = (index) => {
    setSelfWorkoutForm((prev) => ({
      ...prev,
      items:
        prev.items.length <= 1
          ? prev.items
          : prev.items.filter((_, i) => i !== index),
    }))
  }

  const addSelfSet = (itemIndex) => {
    setSelfWorkoutForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              sets: [...item.sets, { setNo: item.sets.length + 1, kg: 0, reps: 0 }],
            }
          : item
      ),
    }))
  }

  const removeSelfSet = (itemIndex, setIndex) => {
    setSelfWorkoutForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== itemIndex) return item
        if (item.sets.length <= 1) return item
        const nextSets = item.sets.filter((_, j) => j !== setIndex)
        return { ...item, sets: normalizeSetNumbers(nextSets) }
      }),
    }))
  }

  const updateSelfSet = (itemIndex, setIndex, key, value) => {
    setSelfWorkoutForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              sets: item.sets.map((setRow, j) =>
                j === setIndex ? { ...setRow, [key]: Number(value) || 0 } : setRow
              ),
            }
          : item
      ),
    }))
  }

  const applyExerciseToSelfWorkout = (itemIndex, exercise) => {
    updateSelfWorkoutItem(itemIndex, {
      exerciseName: exercise.name,
      bodyPart: exercise.body_part || '등',
      category: exercise.category || '웨이트',
      brand: exercise.brand_name || brandNames[0] || '기본',
    })
  }

  const saveSelfWorkout = async () => {
    if (!selfWorkoutForm.workout_date) {
      alert('날짜를 입력해 주세요.')
      return
    }

    const cleanedItems = selfWorkoutForm.items
      .filter((item) => item.exerciseName.trim())
      .map((item) => ({
        ...item,
        sets:
          item.sets && item.sets.length > 0
            ? normalizeSetNumbers(item.sets)
            : [{ setNo: 1, kg: 0, reps: 0 }],
      }))

    if (cleanedItems.length === 0) {
      alert('개인운동도 운동명을 1개 이상 선택하거나 입력해 주세요.')
      return
    }

    setSavingSelfWorkout(true)

    const { data: workoutData, error: workoutError } = await supabase
      .from('workouts')
      .insert([
        {
          member_id: member.id,
          workout_date: selfWorkoutForm.workout_date,
          body_parts: selfWorkoutForm.bodyParts,
          workout_type: 'self',
        },
      ])
      .select()
      .single()

    if (workoutError) {
      alert(`개인운동 저장 오류: ${workoutError.message}`)
      setSavingSelfWorkout(false)
      return
    }

    const itemRows = cleanedItems.flatMap((item) =>
      item.sets.map((setRow, index) => ({
        workout_id: workoutData.id,
        category: item.category,
        body_part: item.bodyPart,
        brand: item.brand,
        exercise_name: item.exerciseName,
        set_no: index + 1,
        kg: Number(setRow.kg) || 0,
        reps: Number(setRow.reps) || 0,
        good_point: item.goodPoint || '',
        improve_point: item.improvePoint || '',
      }))
    )

    const { error: itemError } = await supabase.from('workout_items').insert(itemRows)

    if (itemError) {
      alert(`개인운동 세부 저장 오류: ${itemError.message}`)
      setSavingSelfWorkout(false)
      return
    }

    alert('개인운동 기록 저장 완료')

    setSelfWorkoutForm({
      workout_date: getTodayKST(),
      bodyParts: [],
      items: [createSelfWorkoutItem(brandNames[0] || '기본')],
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
                          {items.length === 0 ? (
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
                <h2>부위 / 기구 선택해서 기록하기</h2>
              </div>
            </div>

            <div className="form-block">
              <div>
                <label>날짜</label>
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
              </div>

              <div>
                <label>운동 부위 선택</label>
                <div className="bodypart-wrap">
                  {bodyPartOptions.map((part) => (
                    <button
                      type="button"
                      key={part}
                      className={`part-btn ${selfWorkoutForm.bodyParts.includes(part) ? 'on' : ''}`}
                      onClick={() => toggleSelfBodyPart(part)}
                    >
                      {part}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="section-head" style={{ marginTop: 18 }}>
              <h3 style={{ margin: 0 }}>운동 목록</h3>
              <button className="secondary-btn" onClick={addSelfWorkoutItem}>
                + 운동 추가
              </button>
            </div>

            {selfWorkoutForm.items.map((item, itemIndex) => (
              <div className="workout-card modern-card" key={item.id}>
                <div className="workout-card-head">
                  <strong>운동 {itemIndex + 1}</strong>
                  {selfWorkoutForm.items.length > 1 && (
                    <button className="danger-btn" onClick={() => removeSelfWorkoutItem(itemIndex)}>
                      삭제
                    </button>
                  )}
                </div>

                <div className="grid-3">
                  <select
                    value={item.category}
                    onChange={(e) => updateSelfWorkoutItem(itemIndex, { category: e.target.value })}
                  >
                    {categoryOptions.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>

                  <select
                    value={item.bodyPart}
                    onChange={(e) => updateSelfWorkoutItem(itemIndex, { bodyPart: e.target.value })}
                  >
                    {bodyPartOptions.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>

                  <select
                    value={item.brand}
                    onChange={(e) => updateSelfWorkoutItem(itemIndex, { brand: e.target.value })}
                  >
                    {brandNames.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <input
                  placeholder="운동명 입력"
                  value={item.exerciseName}
                  onChange={(e) => updateSelfWorkoutItem(itemIndex, { exerciseName: e.target.value })}
                />

                <div className="mini-ex-list">
                  {loadingExercises ? (
                    <span className="muted">운동DB 불러오는 중...</span>
                  ) : (
                    exercises
                      .filter((exercise) => {
                        const categoryMatch = !item.category || exercise.category === item.category

                        if (item.category === '유산소') {
                          return categoryMatch
                        }

                        const bodyPartMatch = !item.bodyPart || exercise.body_part === item.bodyPart
                        return categoryMatch && bodyPartMatch
                      })
                      .slice(0, 12)
                      .map((exercise) => (
                        <button
                          type="button"
                          key={exercise.id}
                          className="mini-ex-item"
                          onClick={() => applyExerciseToSelfWorkout(itemIndex, exercise)}
                        >
                          {exercise.name} · {exercise.brand_name}
                        </button>
                      ))
                  )}
                </div>

                <div className="set-card-wrap">
                  {item.sets.map((setRow, setIndex) => (
                    <div className="set-card" key={`${item.id}-set-${setIndex}`}>
                      <div className="set-card-head">
                        <strong>{setIndex + 1}세트</strong>
                        {item.sets.length > 1 && (
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => removeSelfSet(itemIndex, setIndex)}
                          >
                            세트 삭제
                          </button>
                        )}
                      </div>

                      <div className="grid-2">
                        <div>
                          <label>무게(kg)</label>
                          <input
                            type="number"
                            min="0"
                            value={setRow.kg}
                            onChange={(e) => updateSelfSet(itemIndex, setIndex, 'kg', e.target.value)}
                          />
                        </div>
                        <div>
                          <label>횟수(reps)</label>
                          <input
                            type="number"
                            min="0"
                            value={setRow.reps}
                            onChange={(e) => updateSelfSet(itemIndex, setIndex, 'reps', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="button-row" style={{ marginTop: 12 }}>
                  <button type="button" className="secondary-btn" onClick={() => addSelfSet(itemIndex)}>
                    + 세트 추가
                  </button>
                </div>

                <div className="grid-2">
                  <textarea
                    placeholder="잘한 점"
                    value={item.goodPoint}
                    onChange={(e) => updateSelfWorkoutItem(itemIndex, { goodPoint: e.target.value })}
                  />
                  <textarea
                    placeholder="보완할 점"
                    value={item.improvePoint}
                    onChange={(e) => updateSelfWorkoutItem(itemIndex, { improvePoint: e.target.value })}
                  />
                </div>
              </div>
            ))}

            <div className="save-row">
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
                개인운동은 직접 선택해서 기록하는 용도입니다.
                PT 세션 차감은 관리자 기록 작성 기준으로만 반영됩니다.
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
