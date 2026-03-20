import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import './style.css'

const memberTabs = ['내정보', '저장된 운동기록', '개인운동입력', '식단', '루틴', '사용방법']
const bodyPartOptions = ['가슴', '어깨', '팔', '등', '하체', '스트레칭&재활', '유산소']
const equipmentTypeOptions = [
  '플레이트머신',
  '핀머신',
  '프리웨이트',
  '기타웨이트',
  '랙',
  '유산소기구',
  '소도구',
  '스트레칭&재활',
]
const mealTypeOptions = ['아침', '점심', '저녁', '간식']

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
        equipmentType: row.category || '',
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
    equipmentType: '핀머신',
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

function createDietForm() {
  return {
    date: getTodayKST(),
    meal_type: '아침',
    food_name: '',
    amount: '',
    carbs: '',
    protein: '',
    fat: '',
    meal_time: '',
    hunger_level: 5,
    memo: '',
  }
}

export default function MemberDashboard({ member, accessCode, onLogout }) {
  const [activeTab, setActiveTab] = useState('내정보')
  const [workoutHistory, setWorkoutHistory] = useState([])
  const [expandedWorkoutIds, setExpandedWorkoutIds] = useState([])
  const [routineRows, setRoutineRows] = useState([])
  const [manual, setManual] = useState({
    title: '더피트니스 화정점 사용방법',
    content: '',
  })
  const [exercises, setExercises] = useState([])
  const [dietLogs, setDietLogs] = useState([])

  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingRoutine, setLoadingRoutine] = useState(true)
  const [loadingManual, setLoadingManual] = useState(true)
  const [loadingExercises, setLoadingExercises] = useState(true)
  const [loadingDietLogs, setLoadingDietLogs] = useState(true)

  const [savingSelfWorkout, setSavingSelfWorkout] = useState(false)
  const [savingDiet, setSavingDiet] = useState(false)
  const [editingDietId, setEditingDietId] = useState('')

  const [dietMonthFilter, setDietMonthFilter] = useState(getTodayKST().slice(0, 7))

  const [selfWorkoutForm, setSelfWorkoutForm] = useState({
    workout_date: getTodayKST(),
    bodyParts: [],
    items: [createSelfWorkoutItem('기본')],
  })

  const [dietForm, setDietForm] = useState(createDietForm())

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

  const loadDietLogs = async (monthFilter = dietMonthFilter) => {
    setLoadingDietLogs(true)

    let query = supabase
      .from('diet_logs')
      .select('*')
      .eq('member_id', member.id)
      .order('date', { ascending: false })
      .order('meal_time', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (monthFilter) {
      const start = `${monthFilter}-01`
      const endDate = new Date(`${monthFilter}-01T00:00:00`)
      endDate.setMonth(endDate.getMonth() + 1)
      const end = endDate.toISOString().slice(0, 10)
      query = query.gte('date', start).lt('date', end)
    }

    const { data, error } = await query

    if (error) {
      alert(`식단 기록 불러오기 오류: ${error.message}`)
      setLoadingDietLogs(false)
      return
    }

    setDietLogs(data || [])
    setLoadingDietLogs(false)
  }

  useEffect(() => {
    loadWorkoutHistory()
    loadRoutines()
    loadManual()
    loadExercises()
    loadDietLogs()
    setExpandedWorkoutIds([])
    setActiveTab('내정보')
  }, [member.id])

  useEffect(() => {
    if (activeTab === '식단') {
      loadDietLogs(dietMonthFilter)
    }
  }, [dietMonthFilter])

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

  const dietSummary = useMemo(() => {
    const totalMeals = dietLogs.length
    const avgCarbs =
      totalMeals > 0
        ? Math.round(dietLogs.reduce((sum, row) => sum + (Number(row.carbs) || 0), 0) / totalMeals)
        : 0
    const avgProtein =
      totalMeals > 0
        ? Math.round(dietLogs.reduce((sum, row) => sum + (Number(row.protein) || 0), 0) / totalMeals)
        : 0
    const avgFat =
      totalMeals > 0
        ? Math.round(dietLogs.reduce((sum, row) => sum + (Number(row.fat) || 0), 0) / totalMeals)
        : 0

    return { totalMeals, avgCarbs, avgProtein, avgFat }
  }, [dietLogs])

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
      equipmentType: exercise.category || '핀머신',
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
        category: item.equipmentType,
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

  const startEditDietLog = (log) => {
    setEditingDietId(log.id)
    setDietForm({
      date: log.date || getTodayKST(),
      meal_type: log.meal_type || '아침',
      food_name: log.food_name || '',
      amount: log.amount || '',
      carbs: log.carbs ?? '',
      protein: log.protein ?? '',
      fat: log.fat ?? '',
      meal_time: log.meal_time || '',
      hunger_level: log.hunger_level ?? 5,
      memo: log.memo || '',
    })
    setActiveTab('식단')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEditDietLog = () => {
    setEditingDietId('')
    setDietForm(createDietForm())
  }

  const saveDietLog = async () => {
    if (!dietForm.date) {
      alert('날짜를 입력해 주세요.')
      return
    }

    if (!dietForm.food_name.trim()) {
      alert('음식명을 입력해 주세요.')
      return
    }

    setSavingDiet(true)

    const payload = {
      member_id: member.id,
      date: dietForm.date,
      meal_type: dietForm.meal_type,
      food_name: dietForm.food_name.trim(),
      amount: dietForm.amount.trim(),
      carbs: dietForm.carbs === '' ? null : Number(dietForm.carbs) || 0,
      protein: dietForm.protein === '' ? null : Number(dietForm.protein) || 0,
      fat: dietForm.fat === '' ? null : Number(dietForm.fat) || 0,
      meal_time: dietForm.meal_time,
      hunger_level: dietForm.hunger_level === '' ? null : Number(dietForm.hunger_level) || 0,
      memo: dietForm.memo,
      updated_at: new Date().toISOString(),
    }

    let error = null

    if (editingDietId) {
      const result = await supabase.from('diet_logs').update(payload).eq('id', editingDietId)
      error = result.error
    } else {
      const result = await supabase.from('diet_logs').insert([payload])
      error = result.error
    }

    if (error) {
      alert(`식단 저장 오류: ${error.message}`)
      setSavingDiet(false)
      return
    }

    alert(editingDietId ? '식단 수정 완료' : '식단 기록 저장 완료')
    setEditingDietId('')
    setDietForm(createDietForm())
    await loadDietLogs()
    setSavingDiet(false)
  }

  const deleteDietLog = async (dietLogId) => {
    if (!window.confirm('이 식단 기록을 삭제할까요?')) return

    const { error } = await supabase.from('diet_logs').delete().eq('id', dietLogId)

    if (error) {
      alert(`식단 삭제 오류: ${error.message}`)
      return
    }

    if (editingDietId === dietLogId) {
      cancelEditDietLog()
    }

    alert('식단 기록 삭제 완료')
    await loadDietLogs()
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

        <div className="button-row">
          <div className="pill">입장코드: {accessCode}</div>
          <button className="secondary-btn" onClick={onLogout}>
            로그아웃
          </button>
        </div>
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
                          <button className="secondary-btn" onClick={() => toggleWorkout(workout.id)}>
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
                                  <span className="tag">{item.equipmentType || '-'}</span>
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
                    value={item.equipmentType}
                    onChange={(e) => updateSelfWorkoutItem(itemIndex, { equipmentType: e.target.value })}
                  >
                    {equipmentTypeOptions.map((o) => (
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
                        const typeMatch = !item.equipmentType || exercise.category === item.equipmentType

                        if (item.equipmentType === '유산소기구') {
                          return typeMatch
                        }

                        if (item.equipmentType === '소도구' || item.equipmentType === '스트레칭&재활') {
                          if (!item.bodyPart) return typeMatch
                          return typeMatch && exercise.body_part === item.bodyPart
                        }

                        const bodyPartMatch = !item.bodyPart || exercise.body_part === item.bodyPart
                        return typeMatch && bodyPartMatch
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

      {activeTab === '식단' && (
        <div className="tab-page">
          <section className="card section-card">
            <div className="section-head">
              <div>
                <div className="section-label">{editingDietId ? '식단 수정' : '식단 입력'}</div>
                <h2>{editingDietId ? '식단 기록 수정하기' : '식단 상세 기록'}</h2>
              </div>
              {editingDietId && (
                <button className="secondary-btn" onClick={cancelEditDietLog}>
                  수정 취소
                </button>
              )}
            </div>

            <div className="form-block">
              <div className="grid-2">
                <div>
                  <label>날짜</label>
                  <input
                    type="date"
                    value={dietForm.date}
                    onChange={(e) => setDietForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label>끼니</label>
                  <select
                    value={dietForm.meal_type}
                    onChange={(e) => setDietForm((prev) => ({ ...prev, meal_type: e.target.value }))}
                  >
                    {mealTypeOptions.map((meal) => (
                      <option key={meal}>{meal}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <label>음식명</label>
                  <input
                    placeholder="예: 닭가슴살 샐러드"
                    value={dietForm.food_name}
                    onChange={(e) => setDietForm((prev) => ({ ...prev, food_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label>양</label>
                  <input
                    placeholder="예: 1인분 / 200g"
                    value={dietForm.amount}
                    onChange={(e) => setDietForm((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid-3">
                <div>
                  <label>탄수(g)</label>
                  <input
                    type="number"
                    min="0"
                    value={dietForm.carbs}
                    onChange={(e) => setDietForm((prev) => ({ ...prev, carbs: e.target.value }))}
                  />
                </div>
                <div>
                  <label>단백질(g)</label>
                  <input
                    type="number"
                    min="0"
                    value={dietForm.protein}
                    onChange={(e) => setDietForm((prev) => ({ ...prev, protein: e.target.value }))}
                  />
                </div>
                <div>
                  <label>지방(g)</label>
                  <input
                    type="number"
                    min="0"
                    value={dietForm.fat}
                    onChange={(e) => setDietForm((prev) => ({ ...prev, fat: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <label>식사 시간</label>
                  <input
                    placeholder="예: 08:30"
                    value={dietForm.meal_time}
                    onChange={(e) => setDietForm((prev) => ({ ...prev, meal_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label>배고픔 정도 (0~10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={dietForm.hunger_level}
                    onChange={(e) => setDietForm((prev) => ({ ...prev, hunger_level: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label>메모</label>
                <textarea
                  placeholder="식후 포만감, 특이사항, 간식 여부 등"
                  value={dietForm.memo}
                  onChange={(e) => setDietForm((prev) => ({ ...prev, memo: e.target.value }))}
                />
              </div>

              <div className="save-row">
                <button className="primary-btn" onClick={saveDietLog} disabled={savingDiet}>
                  {savingDiet
                    ? '저장 중...'
                    : editingDietId
                      ? '식단 수정 저장'
                      : '식단 저장'}
                </button>
              </div>
            </div>
          </section>

          <section className="card section-card">
            <div className="section-head">
              <div>
                <div className="section-label">저장된 식단 기록</div>
                <h2>월별 식단 보기</h2>
              </div>
              <div>
                <input
                  type="month"
                  value={dietMonthFilter}
                  onChange={(e) => setDietMonthFilter(e.target.value)}
                  style={{ width: 180 }}
                />
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-box">
                <div className="summary-label">식단 기록 수</div>
                <div className="summary-value">{dietSummary.totalMeals}건</div>
              </div>
              <div className="summary-box">
                <div className="summary-label">평균 탄수</div>
                <div className="summary-value">{dietSummary.avgCarbs}g</div>
              </div>
              <div className="summary-box">
                <div className="summary-label">평균 단백질</div>
                <div className="summary-value">{dietSummary.avgProtein}g</div>
              </div>
              <div className="summary-box">
                <div className="summary-label">평균 지방</div>
                <div className="summary-value">{dietSummary.avgFat}g</div>
              </div>
            </div>

            {loadingDietLogs ? (
              <div className="muted" style={{ marginTop: 16 }}>식단 기록 불러오는 중...</div>
            ) : dietLogs.length === 0 ? (
              <div className="muted" style={{ marginTop: 16 }}>해당 기간 식단 기록이 없습니다.</div>
            ) : (
              <div className="record-list" style={{ marginTop: 16 }}>
                {dietLogs.map((log) => (
                  <div className="record-card" key={log.id}>
                    <div className="record-card-top">
                      <div>
                        <div className="record-date">{log.date}</div>
                        <div className="record-meta">
                          {log.meal_type || '-'} · {log.meal_time || '시간 미입력'}
                        </div>
                      </div>
                      <div className="button-row">
                        <div className="pill">배고픔 {log.hunger_level ?? '-'} / 10</div>
                        <button className="secondary-btn" onClick={() => startEditDietLog(log)}>
                          수정
                        </button>
                        <button className="danger-btn" onClick={() => deleteDietLog(log.id)}>
                          삭제
                        </button>
                      </div>
                    </div>

                    <div className="summary-grid" style={{ marginTop: 12 }}>
                      <div className="summary-box">
                        <div className="summary-label">음식명</div>
                        <div className="summary-value" style={{ fontSize: 16 }}>
                          {log.food_name || '-'}
                        </div>
                      </div>
                      <div className="summary-box">
                        <div className="summary-label">양</div>
                        <div className="summary-value" style={{ fontSize: 16 }}>
                          {log.amount || '-'}
                        </div>
                      </div>
                      <div className="summary-box">
                        <div className="summary-label">탄수</div>
                        <div className="summary-value">{log.carbs ?? 0}g</div>
                      </div>
                      <div className="summary-box">
                        <div className="summary-label">단백질</div>
                        <div className="summary-value">{log.protein ?? 0}g</div>
                      </div>
                      <div className="summary-box">
                        <div className="summary-label">지방</div>
                        <div className="summary-value">{log.fat ?? 0}g</div>
                      </div>
                      <div className="summary-box">
                        <div className="summary-label">메모</div>
                        <div className="summary-value" style={{ fontSize: 16 }}>
                          {log.memo || '-'}
                        </div>
                      </div>
                    </div>

                    {log.feedback && (
                      <div className="feedback good" style={{ marginTop: 14 }}>
                        <div className="memo-title">관리자 피드백</div>
                        <div>{log.feedback}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
