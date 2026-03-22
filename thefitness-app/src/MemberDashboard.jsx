import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import logo from './assets/logo.png'

const TABS = [
  '내정보',
  '건강정보',
  '운동기록',
  '개인운동입력',
  '식단',
  '루틴',
  '프로그램',
  '코치스케줄',
  '공지사항',
  '사용방법',
]

const MEMBER_STORAGE_KEY = 'thefitness_hwajeong_member_session_v1'

const emptyPersonalForm = {
  id: null,
  workout_date: new Date().toISOString().slice(0, 10),
  good: '',
  improve: '',
  items: [
    {
      exercise_id: '',
      exercise_name_snapshot: '',
      sets: [{ kg: '', reps: '' }],
    },
  ],
}

const emptyDietForm = {
  id: null,
  log_date: new Date().toISOString().slice(0, 10),
  meal_type: '아침',
  meal_time: '',
  content: '',
  carb_g: '',
  protein_g: '',
  fat_g: '',
  product_brand: '',
  product_name: '',
  meal_category: '일반식',
  hunger_level: 0,
  member_note: '',
}

const emptyHealthForm = {
  id: null,
  record_date: new Date().toISOString().slice(0, 10),
  height_cm: '',
  weight_kg: '',
  body_fat_percent: '',
  skeletal_muscle_mass: '',
  medical_history: '',
  member_note: '',
  inbody_image_url: '',
}

function getTotalSetCount(items = []) {
  return items.reduce((sum, item) => sum + (item.sets?.length || 0), 0)
}

function normalizeSets(sets = []) {
  return sets
    .filter((setRow) => setRow.kg !== '' || setRow.reps !== '')
    .map((setRow) => ({
      kg: String(setRow.kg ?? ''),
      reps: String(setRow.reps ?? ''),
    }))
}

function getMonthKey(dateString) {
  return (dateString || '').slice(0, 7)
}

export default function MemberDashboard({ member, accessCode, onLogout }) {
  const [activeTab, setActiveTab] = useState('내정보')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [memberInfo, setMemberInfo] = useState(member)

  const [workouts, setWorkouts] = useState([])
  const [workoutItemsMap, setWorkoutItemsMap] = useState({})
  const [collapsedWorkouts, setCollapsedWorkouts] = useState({})

  const [exercises, setExercises] = useState([])
  const [personalForm, setPersonalForm] = useState(emptyPersonalForm)

  const [dietLogs, setDietLogs] = useState([])
  const [collapsedDiets, setCollapsedDiets] = useState({})
  const [dietForm, setDietForm] = useState(emptyDietForm)

  const [healthLogs, setHealthLogs] = useState([])
  const [collapsedHealthLogs, setCollapsedHealthLogs] = useState({})
  const [healthForm, setHealthForm] = useState(emptyHealthForm)

  const [routine, setRoutine] = useState(null)
  const [manual, setManual] = useState(null)

  const [programs, setPrograms] = useState([])
  const [currentProgram, setCurrentProgram] = useState(null)

  const [coaches, setCoaches] = useState([])
  const [coachSchedules, setCoachSchedules] = useState([])
  const [coachScheduleSlotsMap, setCoachScheduleSlotsMap] = useState({})
  const [collapsedSchedules, setCollapsedSchedules] = useState({})
  const [scheduleMonth, setScheduleMonth] = useState(new Date().toISOString().slice(0, 7))

  const [notices, setNotices] = useState([])
  const [collapsedNotices, setCollapsedNotices] = useState({})

  const stats = useMemo(() => {
    const ptCount = workouts.filter((workout) => workout.workout_type === 'pt').length
    const personalCount = workouts.filter((workout) => workout.workout_type === 'personal').length
    const remainingSessions = Math.max(
      Number(memberInfo.total_sessions || 0) - Number(memberInfo.used_sessions || 0),
      0,
    )

    return {
      ptCount,
      personalCount,
      remainingSessions,
    }
  }, [workouts, memberInfo])

  const progressPercent = useMemo(() => {
    const total = Number(memberInfo.total_sessions || 0)
    const used = Number(memberInfo.used_sessions || 0)
    if (!total) return 0
    return Math.min(Math.round((used / total) * 100), 100)
  }, [memberInfo])

  const filteredSchedules = useMemo(() => {
    return coachSchedules.filter((schedule) => getMonthKey(schedule.schedule_date) === scheduleMonth)
  }, [coachSchedules, scheduleMonth])

  const publishedNotices = useMemo(() => {
    return notices.filter((notice) => notice.is_published)
  }, [notices])

  useEffect(() => {
    loadAll()
  }, [memberInfo?.id])

  const loadAll = async () => {
    setLoading(true)
    setMessage('')

    await Promise.all([
      loadMemberInfo(),
      loadExercises(),
      loadWorkouts(),
      loadDietLogs(),
      loadHealthLogs(),
      loadRoutine(),
      loadManual(),
      loadPrograms(),
      loadCoaches(),
      loadCoachSchedules(),
      loadNotices(),
    ])

    setLoading(false)
  }

  const loadMemberInfo = async () => {
    const { data } = await supabase
      .from('members')
      .select('*, programs(id, name, price, session_count, description, is_vip, is_active)')
      .eq('id', member.id)
      .maybeSingle()

    if (data) {
      setMemberInfo(data)
      setCurrentProgram(data.programs || null)
      localStorage.setItem(
        MEMBER_STORAGE_KEY,
        JSON.stringify({
          member: data,
          accessCode,
        }),
      )
    }
  }

  const loadExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*, brands(id, name)')
      .order('created_at', { ascending: false })

    if (data) setExercises(data)
  }

  const loadWorkouts = async () => {
    const { data: workoutData } = await supabase
      .from('workouts')
      .select('*')
      .eq('member_id', member.id)
      .order('workout_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!workoutData) return

    let itemMap = {}
    const workoutIds = workoutData.map((workout) => workout.id)

    if (workoutIds.length > 0) {
      const { data: itemData } = await supabase
        .from('workout_items')
        .select('*')
        .in('workout_id', workoutIds)
        .order('sort_order', { ascending: true })

      itemMap = (itemData || []).reduce((acc, item) => {
        if (!acc[item.workout_id]) acc[item.workout_id] = []
        acc[item.workout_id].push(item)
        return acc
      }, {})
    }

    const collapsed = {}
    workoutData.forEach((workout) => {
      collapsed[workout.id] = true
    })

    setWorkouts(workoutData)
    setWorkoutItemsMap(itemMap)
    setCollapsedWorkouts(collapsed)
  }

  const loadDietLogs = async () => {
    const { data } = await supabase
      .from('diet_logs')
      .select('*')
      .eq('member_id', member.id)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (data) {
      const collapsed = {}
      data.forEach((diet) => {
        collapsed[diet.id] = true
      })
      setDietLogs(data)
      setCollapsedDiets(collapsed)
    }
  }

  const loadHealthLogs = async () => {
    const { data } = await supabase
      .from('member_health_logs')
      .select('*')
      .eq('member_id', member.id)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (data) {
      const collapsed = {}
      data.forEach((item) => {
        collapsed[item.id] = true
      })
      setHealthLogs(data)
      setCollapsedHealthLogs(collapsed)
    }
  }

  const loadRoutine = async () => {
    const { data } = await supabase
      .from('member_routines')
      .select('*')
      .eq('member_id', member.id)
      .maybeSingle()

    setRoutine(data || null)
  }

  const loadManual = async () => {
    const { data } = await supabase
      .from('app_manuals')
      .select('*')
      .eq('target_role', 'member')
      .maybeSingle()

    setManual(data || null)
  }

  const loadPrograms = async () => {
    const { data } = await supabase
      .from('programs')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (data) setPrograms(data)
  }

  const loadCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (data) setCoaches(data)
  }

  const loadCoachSchedules = async () => {
    const { data: scheduleData } = await supabase
      .from('coach_schedules')
      .select('*')
      .order('schedule_date', { ascending: false })

    if (!scheduleData) return

    let slotMap = {}
    const scheduleIds = scheduleData.map((schedule) => schedule.id)

    if (scheduleIds.length > 0) {
      const { data: slotData } = await supabase
        .from('coach_schedule_slots')
        .select('*')
        .in('schedule_id', scheduleIds)
        .order('slot_time', { ascending: true })

      slotMap = (slotData || []).reduce((acc, slot) => {
        if (!acc[slot.schedule_id]) acc[slot.schedule_id] = []
        acc[slot.schedule_id].push(slot)
        return acc
      }, {})
    }

    const collapsed = {}
    scheduleData.forEach((schedule) => {
      collapsed[schedule.id] = true
    })

    setCoachSchedules(scheduleData)
    setCoachScheduleSlotsMap(slotMap)
    setCollapsedSchedules(collapsed)
  }

  const loadNotices = async () => {
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      const collapsed = {}
      data.forEach((notice) => {
        collapsed[notice.id] = true
      })
      setNotices(data)
      setCollapsedNotices(collapsed)
    }
  }

  const resetPersonalForm = () => {
    setPersonalForm(emptyPersonalForm)
  }

  const updatePersonalItemSelect = (itemIndex, exerciseId) => {
    const found = exercises.find((exercise) => String(exercise.id) === String(exerciseId))
    setPersonalForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        exercise_id: found?.id || '',
        exercise_name_snapshot: found?.name || nextItems[itemIndex].exercise_name_snapshot,
      }
      return { ...prev, items: nextItems }
    })
  }

  const updatePersonalItemName = (itemIndex, value) => {
    setPersonalForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        exercise_name_snapshot: value,
      }
      return { ...prev, items: nextItems }
    })
  }

  const addPersonalItem = () => {
    setPersonalForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          exercise_id: '',
          exercise_name_snapshot: '',
          sets: [{ kg: '', reps: '' }],
        },
      ],
    }))
  }

  const removePersonalItem = (itemIndex) => {
    setPersonalForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== itemIndex),
    }))
  }

  const addSet = (itemIndex) => {
    setPersonalForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        sets: [...nextItems[itemIndex].sets, { kg: '', reps: '' }],
      }
      return { ...prev, items: nextItems }
    })
  }

  const removeSet = (itemIndex, setIndex) => {
    setPersonalForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        sets: nextItems[itemIndex].sets.filter((_, idx) => idx !== setIndex),
      }
      return { ...prev, items: nextItems }
    })
  }

  const updateSetValue = (itemIndex, setIndex, field, value) => {
    setPersonalForm((prev) => {
      const nextItems = [...prev.items]
      const nextSets = [...nextItems[itemIndex].sets]
      nextSets[setIndex] = {
        ...nextSets[setIndex],
        [field]: value,
      }
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        sets: nextSets,
      }
      return { ...prev, items: nextItems }
    })
  }

  const handlePersonalSubmit = async (e) => {
    e.preventDefault()

    const cleanedItems = personalForm.items
      .filter((item) => item.exercise_name_snapshot?.trim())
      .map((item, index) => ({
        exercise_id: item.exercise_id || null,
        exercise_name_snapshot: item.exercise_name_snapshot.trim(),
        sort_order: index,
        sets: normalizeSets(item.sets),
      }))

    if (cleanedItems.length === 0) {
      setMessage('최소 1개의 운동을 입력해주세요.')
      return
    }

    const payload = {
      member_id: member.id,
      workout_date: personalForm.workout_date,
      workout_type: 'personal',
      good: personalForm.good?.trim() || '',
      improve: personalForm.improve?.trim() || '',
      created_by: null,
    }

    let workoutId = personalForm.id

    if (personalForm.id) {
      await supabase.from('workouts').update(payload).eq('id', personalForm.id)
      await supabase.from('workout_items').delete().eq('workout_id', personalForm.id)
    } else {
      const { data } = await supabase.from('workouts').insert(payload).select().single()
      workoutId = data.id
    }

    await supabase.from('workout_items').insert(
      cleanedItems.map((item) => ({
        ...item,
        workout_id: workoutId,
      })),
    )

    setMessage(personalForm.id ? '개인운동이 수정되었습니다.' : '개인운동이 저장되었습니다.')
    resetPersonalForm()
    await loadWorkouts()
    setActiveTab('운동기록')
  }

  const handlePersonalEdit = (workout) => {
    const items = workoutItemsMap[workout.id] || []

    setPersonalForm({
      id: workout.id,
      workout_date: workout.workout_date,
      good: workout.good || '',
      improve: workout.improve || '',
      items:
        items.length > 0
          ? items.map((item) => ({
              exercise_id: item.exercise_id || '',
              exercise_name_snapshot: item.exercise_name_snapshot || '',
              sets:
                Array.isArray(item.sets) && item.sets.length > 0
                  ? item.sets
                  : [{ kg: '', reps: '' }],
            }))
          : [
              {
                exercise_id: '',
                exercise_name_snapshot: '',
                sets: [{ kg: '', reps: '' }],
              },
            ],
    })

    setActiveTab('개인운동입력')
  }

  const handlePersonalDelete = async (workoutId) => {
    if (!window.confirm('개인운동 기록을 삭제할까요?')) return
    await supabase.from('workouts').delete().eq('id', workoutId)
    await loadWorkouts()
    setMessage('개인운동 기록이 삭제되었습니다.')
  }

  const resetDietForm = () => {
    setDietForm(emptyDietForm)
  }

  const handleDietSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      member_id: member.id,
      log_date: dietForm.log_date,
      meal_type: dietForm.meal_type?.trim() || '아침',
      meal_time: dietForm.meal_time || null,
      content: dietForm.content?.trim() || '',
      carb_g: Number(dietForm.carb_g) || 0,
      protein_g: Number(dietForm.protein_g) || 0,
      fat_g: Number(dietForm.fat_g) || 0,
      product_brand: dietForm.product_brand?.trim() || '',
      product_name: dietForm.product_name?.trim() || '',
      meal_category: dietForm.meal_category?.trim() || '일반식',
      hunger_level: Number(dietForm.hunger_level) || 0,
      member_note: dietForm.member_note?.trim() || '',
    }

    if (!payload.content) {
      setMessage('식단 내용을 입력해주세요.')
      return
    }

    if (dietForm.id) {
      await supabase.from('diet_logs').update(payload).eq('id', dietForm.id)
      setMessage('식단이 수정되었습니다.')
    } else {
      await supabase.from('diet_logs').insert(payload)
      setMessage('식단이 저장되었습니다.')
    }

    resetDietForm()
    await loadDietLogs()
  }

  const handleDietEdit = (diet) => {
    setDietForm({
      id: diet.id,
      log_date: diet.log_date || new Date().toISOString().slice(0, 10),
      meal_type: diet.meal_type || '아침',
      meal_time: diet.meal_time || '',
      content: diet.content || '',
      carb_g: diet.carb_g || '',
      protein_g: diet.protein_g || '',
      fat_g: diet.fat_g || '',
      product_brand: diet.product_brand || '',
      product_name: diet.product_name || '',
      meal_category: diet.meal_category || '일반식',
      hunger_level: diet.hunger_level || 0,
      member_note: diet.member_note || '',
    })
    setActiveTab('식단')
  }

  const handleDietDelete = async (dietId) => {
    if (!window.confirm('식단 기록을 삭제할까요?')) return
    await supabase.from('diet_logs').delete().eq('id', dietId)
    await loadDietLogs()
    setMessage('식단 기록이 삭제되었습니다.')
  }

  const resetHealthForm = () => {
    setHealthForm(emptyHealthForm)
  }

  const handleHealthSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      member_id: member.id,
      record_date: healthForm.record_date,
      height_cm: Number(healthForm.height_cm) || null,
      weight_kg: Number(healthForm.weight_kg) || null,
      body_fat_percent: Number(healthForm.body_fat_percent) || null,
      skeletal_muscle_mass: Number(healthForm.skeletal_muscle_mass) || null,
      medical_history: healthForm.medical_history?.trim() || '',
      member_note: healthForm.member_note?.trim() || '',
      inbody_image_url: healthForm.inbody_image_url?.trim() || '',
    }

    if (healthForm.id) {
      await supabase.from('member_health_logs').update(payload).eq('id', healthForm.id)
      setMessage('건강정보가 수정되었습니다.')
    } else {
      await supabase.from('member_health_logs').insert(payload)
      setMessage('건강정보가 저장되었습니다.')
    }

    resetHealthForm()
    await loadHealthLogs()
  }

  const handleHealthEdit = (health) => {
    setHealthForm({
      id: health.id,
      record_date: health.record_date || new Date().toISOString().slice(0, 10),
      height_cm: health.height_cm || '',
      weight_kg: health.weight_kg || '',
      body_fat_percent: health.body_fat_percent || '',
      skeletal_muscle_mass: health.skeletal_muscle_mass || '',
      medical_history: health.medical_history || '',
      member_note: health.member_note || '',
      inbody_image_url: health.inbody_image_url || '',
    })
    setActiveTab('건강정보')
  }

  const handleHealthDelete = async (healthId) => {
    if (!window.confirm('건강정보 기록을 삭제할까요?')) return
    await supabase.from('member_health_logs').delete().eq('id', healthId)
    await loadHealthLogs()
    setMessage('건강정보 기록이 삭제되었습니다.')
  }

  if (loading) {
    return <div className="loading-card">데이터 불러오는 중...</div>
  }

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <img src={logo} alt="더피트니스 화정점 로고" className="topbar-logo small" />
          <div>
            <div className="brand-mark">더피트니스 화정점</div>
            <h1 className="page-title">{memberInfo.name} 회원 페이지</h1>
            <p className="sub-text">access code 인증 완료</p>
          </div>
        </div>

        <button className="secondary-btn" onClick={onLogout}>
          나가기
        </button>
      </header>

      <nav className="tab-row">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {message ? <div className="message success">{message}</div> : null}

      {activeTab === '내정보' && (
        <div className="stack-gap">
          <div className="two-col">
            <section className="card">
              <h2>내 정보</h2>
              <div className="detail-box">
                <p><strong>이름:</strong> {memberInfo.name}</p>
                <p><strong>목표:</strong> {memberInfo.goal || '-'}</p>
                <p><strong>시작일:</strong> {memberInfo.start_date || '-'}</p>
                <p><strong>종료일:</strong> {memberInfo.end_date || '-'}</p>
                <p><strong>회원 메모:</strong> {memberInfo.memo || '-'}</p>
              </div>
            </section>

            <section className="card">
              <h2>세션 진행 현황</h2>
              <div className="detail-box">
                <p><strong>총 세션:</strong> {memberInfo.total_sessions || 0}회</p>
                <p><strong>사용 세션:</strong> {memberInfo.used_sessions || 0}회</p>
                <p><strong>남은 세션:</strong> {stats.remainingSessions}회</p>
              </div>

              <div className="progress-wrap">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <span>{progressPercent}% 진행</span>
              </div>
            </section>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span>내 PT 횟수</span>
              <strong>{stats.ptCount}</strong>
            </div>
            <div className="stat-card">
              <span>내 개인운동 횟수</span>
              <strong>{stats.personalCount}</strong>
            </div>
            <div className="stat-card">
              <span>남은 세션</span>
              <strong>{stats.remainingSessions}</strong>
            </div>
          </div>
        </div>
      )}

      {activeTab === '건강정보' && (
        <div className="two-col">
          <section className="card">
            <h2>건강정보 입력 / 수정</h2>

            <form className="stack-gap" onSubmit={handleHealthSubmit}>
              <label className="field">
                <span>기록일</span>
                <input
                  type="date"
                  value={healthForm.record_date}
                  onChange={(e) => setHealthForm({ ...healthForm, record_date: e.target.value })}
                />
              </label>

              <div className="grid-2">
                <label className="field">
                  <span>키(cm)</span>
                  <input
                    type="number"
                    value={healthForm.height_cm}
                    onChange={(e) => setHealthForm({ ...healthForm, height_cm: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>체중(kg)</span>
                  <input
                    type="number"
                    value={healthForm.weight_kg}
                    onChange={(e) => setHealthForm({ ...healthForm, weight_kg: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid-2">
                <label className="field">
                  <span>체지방률(%)</span>
                  <input
                    type="number"
                    value={healthForm.body_fat_percent}
                    onChange={(e) => setHealthForm({ ...healthForm, body_fat_percent: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>골격근량</span>
                  <input
                    type="number"
                    value={healthForm.skeletal_muscle_mass}
                    onChange={(e) => setHealthForm({ ...healthForm, skeletal_muscle_mass: e.target.value })}
                  />
                </label>
              </div>

              <label className="field">
                <span>병력사항</span>
                <textarea
                  rows="4"
                  value={healthForm.medical_history}
                  onChange={(e) => setHealthForm({ ...healthForm, medical_history: e.target.value })}
                />
              </label>

              <label className="field">
                <span>개인 메모</span>
                <textarea
                  rows="4"
                  value={healthForm.member_note}
                  onChange={(e) => setHealthForm({ ...healthForm, member_note: e.target.value })}
                />
              </label>

              <label className="field">
                <span>인바디 이미지 URL</span>
                <input
                  value={healthForm.inbody_image_url}
                  onChange={(e) => setHealthForm({ ...healthForm, inbody_image_url: e.target.value })}
                  placeholder="이미지 링크를 넣어주세요"
                />
              </label>

              <div className="inline-actions wrap">
                <button className="primary-btn" type="submit">
                  {healthForm.id ? '건강정보 수정' : '건강정보 저장'}
                </button>
                <button type="button" className="secondary-btn" onClick={resetHealthForm}>
                  초기화
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>내 건강정보 기록</h2>

            <div className="list-stack">
              {healthLogs.map((health) => {
                const collapsed = collapsedHealthLogs[health.id] ?? true
                return (
                  <div key={health.id} className="list-card">
                    <div className="list-card-top">
                      <strong>{health.record_date}</strong>
                      <span className="pill">체중 {health.weight_kg || '-'}kg</span>
                    </div>

                    <div className="compact-text">
                      간략히보기: 키 {health.height_cm || '-'} / 체지방 {health.body_fat_percent || '-'} / 골격근 {health.skeletal_muscle_mass || '-'}
                    </div>

                    <div className="inline-actions wrap">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() =>
                          setCollapsedHealthLogs((prev) => ({
                            ...prev,
                            [health.id]: !collapsed,
                          }))
                        }
                      >
                        {collapsed ? '상세히보기' : '간략히보기'}
                      </button>

                      <button type="button" className="secondary-btn" onClick={() => handleHealthEdit(health)}>
                        수정
                      </button>

                      <button type="button" className="danger-btn" onClick={() => handleHealthDelete(health.id)}>
                        삭제
                      </button>
                    </div>

                    {!collapsed ? (
                      <div className="detail-box">
                        <p><strong>키:</strong> {health.height_cm || '-'}</p>
                        <p><strong>체중:</strong> {health.weight_kg || '-'}</p>
                        <p><strong>체지방률:</strong> {health.body_fat_percent || '-'}</p>
                        <p><strong>골격근량:</strong> {health.skeletal_muscle_mass || '-'}</p>
                        <p><strong>병력사항:</strong> {health.medical_history || '-'}</p>
                        <p><strong>개인 메모:</strong> {health.member_note || '-'}</p>
                        <p><strong>인바디 이미지 URL:</strong> {health.inbody_image_url || '-'}</p>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === '운동기록' && (
        <div className="card">
          <h2>운동기록</h2>

          <div className="list-stack">
            {workouts.map((workout) => {
              const items = workoutItemsMap[workout.id] || []
              const collapsed = collapsedWorkouts[workout.id] ?? true
              const isPersonal = workout.workout_type === 'personal'

              return (
                <div key={workout.id} className="list-card">
                  <div className="list-card-top">
                    <strong>{isPersonal ? '개인운동' : 'PT 기록'}</strong>
                    <span className="pill">{workout.workout_date}</span>
                  </div>

                  <div className="compact-text">
                    간략히보기: 운동 {items.length}개 / 총세트 {getTotalSetCount(items)}세트
                  </div>

                  <div className="inline-actions wrap">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        setCollapsedWorkouts((prev) => ({
                          ...prev,
                          [workout.id]: !collapsed,
                        }))
                      }
                    >
                      {collapsed ? '상세히보기' : '간략히보기'}
                    </button>

                    {isPersonal ? (
                      <>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => handlePersonalEdit(workout)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => handlePersonalDelete(workout.id)}
                        >
                          삭제
                        </button>
                      </>
                    ) : null}
                  </div>

                  {!collapsed ? (
                    <div className="detail-box">
                      {items.map((item) => (
                        <div key={item.id} className="record-item-box">
                          <strong>{item.exercise_name_snapshot}</strong>
                          <ul className="set-list">
                            {(item.sets || []).map((setRow, idx) => (
                              <li key={idx}>
                                {idx + 1}세트 - {setRow.kg || '-'}kg / {setRow.reps || '-'}회
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <p><strong>잘한점:</strong> {workout.good || '-'}</p>
                      <p><strong>보완점:</strong> {workout.improve || '-'}</p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === '개인운동입력' && (
        <div className="card">
          <h2>개인운동 입력 / 수정</h2>

          <form className="stack-gap" onSubmit={handlePersonalSubmit}>
            <label className="field">
              <span>날짜</span>
              <input
                type="date"
                value={personalForm.workout_date}
                onChange={(e) => setPersonalForm({ ...personalForm, workout_date: e.target.value })}
              />
            </label>

            {personalForm.items.map((item, itemIndex) => (
              <div key={itemIndex} className="sub-card">
                <div className="list-card-top">
                  <strong>운동 {itemIndex + 1}</strong>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => removePersonalItem(itemIndex)}
                    disabled={personalForm.items.length === 1}
                  >
                    운동 삭제
                  </button>
                </div>

                <label className="field">
                  <span>운동DB 선택</span>
                  <select
                    value={item.exercise_id}
                    onChange={(e) => updatePersonalItemSelect(itemIndex, e.target.value)}
                  >
                    <option value="">선택 안함</option>
                    {exercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        [{exercise.brands?.name || '브랜드없음'}] {exercise.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>운동명 직접 입력</span>
                  <input
                    value={item.exercise_name_snapshot}
                    onChange={(e) => updatePersonalItemName(itemIndex, e.target.value)}
                    placeholder="예: 스쿼트, 힙힌지, 밴드 워크"
                  />
                </label>

                <div className="stack-gap">
                  {item.sets.map((setRow, setIndex) => (
                    <div className="set-row" key={setIndex}>
                      <input
                        placeholder="kg"
                        value={setRow.kg}
                        onChange={(e) => updateSetValue(itemIndex, setIndex, 'kg', e.target.value)}
                      />
                      <input
                        placeholder="reps"
                        value={setRow.reps}
                        onChange={(e) => updateSetValue(itemIndex, setIndex, 'reps', e.target.value)}
                      />
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => removeSet(itemIndex, setIndex)}
                        disabled={item.sets.length === 1}
                      >
                        세트 삭제
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" className="secondary-btn" onClick={() => addSet(itemIndex)}>
                  세트 추가
                </button>
              </div>
            ))}

            <button type="button" className="secondary-btn" onClick={addPersonalItem}>
              운동 추가
            </button>

            <label className="field">
              <span>잘한점</span>
              <textarea
                rows="3"
                value={personalForm.good}
                onChange={(e) => setPersonalForm({ ...personalForm, good: e.target.value })}
              />
            </label>

            <label className="field">
              <span>보완점</span>
              <textarea
                rows="3"
                value={personalForm.improve}
                onChange={(e) => setPersonalForm({ ...personalForm, improve: e.target.value })}
              />
            </label>

            <div className="inline-actions wrap">
              <button className="primary-btn" type="submit">
                {personalForm.id ? '개인운동 수정' : '개인운동 저장'}
              </button>
              <button type="button" className="secondary-btn" onClick={resetPersonalForm}>
                초기화
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === '식단' && (
        <div className="two-col">
          <section className="card">
            <h2>식단 입력 / 수정</h2>

            <form className="stack-gap" onSubmit={handleDietSubmit}>
              <div className="grid-2">
                <label className="field">
                  <span>날짜</span>
                  <input
                    type="date"
                    value={dietForm.log_date}
                    onChange={(e) => setDietForm({ ...dietForm, log_date: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>식사 종류</span>
                  <select
                    value={dietForm.meal_type}
                    onChange={(e) => setDietForm({ ...dietForm, meal_type: e.target.value })}
                  >
                    <option value="아침">아침</option>
                    <option value="점심">점심</option>
                    <option value="저녁">저녁</option>
                    <option value="간식">간식</option>
                  </select>
                </label>
              </div>

              <div className="grid-2">
                <label className="field">
                  <span>먹은 시간</span>
                  <input
                    type="time"
                    value={dietForm.meal_time}
                    onChange={(e) => setDietForm({ ...dietForm, meal_time: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>식사 유형</span>
                  <select
                    value={dietForm.meal_category}
                    onChange={(e) => setDietForm({ ...dietForm, meal_category: e.target.value })}
                  >
                    <option value="일반식">일반식</option>
                    <option value="집밥">집밥</option>
                    <option value="외식">외식</option>
                    <option value="제품">제품</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>내용</span>
                <textarea
                  rows="4"
                  value={dietForm.content}
                  onChange={(e) => setDietForm({ ...dietForm, content: e.target.value })}
                />
              </label>

              <div className="grid-3">
                <label className="field">
                  <span>탄수화물(g)</span>
                  <input
                    type="number"
                    value={dietForm.carb_g}
                    onChange={(e) => setDietForm({ ...dietForm, carb_g: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>단백질(g)</span>
                  <input
                    type="number"
                    value={dietForm.protein_g}
                    onChange={(e) => setDietForm({ ...dietForm, protein_g: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>지방(g)</span>
                  <input
                    type="number"
                    value={dietForm.fat_g}
                    onChange={(e) => setDietForm({ ...dietForm, fat_g: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid-2">
                <label className="field">
                  <span>제품 브랜드</span>
                  <input
                    value={dietForm.product_brand}
                    onChange={(e) => setDietForm({ ...dietForm, product_brand: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>제품 이름</span>
                  <input
                    value={dietForm.product_name}
                    onChange={(e) => setDietForm({ ...dietForm, product_name: e.target.value })}
                  />
                </label>
              </div>

              <label className="field">
                <span>배고픔 정도 (0~10)</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={dietForm.hunger_level}
                  onChange={(e) => setDietForm({ ...dietForm, hunger_level: e.target.value })}
                />
              </label>

              <label className="field">
                <span>개인 메모</span>
                <textarea
                  rows="3"
                  value={dietForm.member_note}
                  onChange={(e) => setDietForm({ ...dietForm, member_note: e.target.value })}
                />
              </label>

              <div className="inline-actions wrap">
                <button className="primary-btn" type="submit">
                  {dietForm.id ? '식단 수정' : '식단 저장'}
                </button>
                <button type="button" className="secondary-btn" onClick={resetDietForm}>
                  초기화
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>내 식단 기록</h2>

            <div className="list-stack">
              {dietLogs.map((diet) => {
                const collapsed = collapsedDiets[diet.id] ?? true

                return (
                  <div key={diet.id} className="list-card">
                    <div className="list-card-top">
                      <strong>{diet.meal_type}</strong>
                      <span className="pill">{diet.log_date}</span>
                    </div>

                    <div className="compact-text">
                      간략히보기: {diet.meal_time || '-'} / {diet.content?.slice(0, 26) || ''}
                      {diet.content?.length > 26 ? '...' : ''}
                    </div>

                    <div className="inline-actions wrap">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() =>
                          setCollapsedDiets((prev) => ({
                            ...prev,
                            [diet.id]: !collapsed,
                          }))
                        }
                      >
                        {collapsed ? '상세히보기' : '간략히보기'}
                      </button>

                      <button type="button" className="secondary-btn" onClick={() => handleDietEdit(diet)}>
                        수정
                      </button>

                      <button type="button" className="danger-btn" onClick={() => handleDietDelete(diet.id)}>
                        삭제
                      </button>
                    </div>

                    {!collapsed ? (
                      <div className="detail-box">
                        <p><strong>시간:</strong> {diet.meal_time || '-'}</p>
                        <p><strong>내용:</strong> {diet.content || '-'}</p>
                        <p><strong>탄수/단백질/지방:</strong> {diet.carb_g || 0}g / {diet.protein_g || 0}g / {diet.fat_g || 0}g</p>
                        <p><strong>브랜드/제품:</strong> {diet.product_brand || '-'} / {diet.product_name || '-'}</p>
                        <p><strong>식사 유형:</strong> {diet.meal_category || '-'}</p>
                        <p><strong>배고픔 정도:</strong> {diet.hunger_level || 0}</p>
                        <p><strong>개인 메모:</strong> {diet.member_note || '-'}</p>
                        <p><strong>코치 피드백:</strong> {diet.coach_feedback || '아직 피드백이 없습니다.'}</p>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === '루틴' && (
        <div className="card">
          <h2>{routine?.title || '루틴'}</h2>
          <div className="detail-box">
            <pre className="pre-text">{routine?.content || '아직 등록된 루틴이 없습니다.'}</pre>
          </div>
        </div>
      )}

      {activeTab === '프로그램' && (
        <div className="stack-gap">
          <section className="card">
            <h2>현재 이용 중인 프로그램</h2>
            <div className="detail-box">
              {currentProgram ? (
                <>
                  <p><strong>프로그램명:</strong> {currentProgram.name}</p>
                  <p><strong>가격:</strong> {Number(currentProgram.price || 0).toLocaleString()}원</p>
                  <p><strong>횟수:</strong> {currentProgram.session_count}회</p>
                  <p><strong>유형:</strong> {currentProgram.is_vip ? 'VIP' : '일반'}</p>
                  <p><strong>설명:</strong> {currentProgram.description || '-'}</p>
                </>
              ) : (
                <p>현재 연결된 프로그램이 없습니다.</p>
              )}
            </div>
          </section>

          <section className="card">
            <h2>전체 프로그램 보기</h2>
            <div className="list-stack">
              {programs.map((program) => (
                <div key={program.id} className="list-card">
                  <div className="list-card-top">
                    <strong>{program.name}</strong>
                    <span className="pill">{program.is_vip ? 'VIP' : '일반'}</span>
                  </div>
                  <div className="compact-text">
                    {Number(program.price || 0).toLocaleString()}원 / {program.session_count}회
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === '코치스케줄' && (
        <div className="card">
          <div className="section-head">
            <h2>코치 스케줄</h2>
            <input
              type="month"
              value={scheduleMonth}
              onChange={(e) => setScheduleMonth(e.target.value)}
            />
          </div>

          <div className="list-stack">
            {filteredSchedules.map((schedule) => {
              const coach = coaches.find((item) => item.id === schedule.coach_id)
              const collapsed = collapsedSchedules[schedule.id] ?? true
              const slots = coachScheduleSlotsMap[schedule.id] || []

              return (
                <div key={schedule.id} className="list-card">
                  <div className="list-card-top">
                    <strong>{coach?.name || '코치'} / {schedule.schedule_date}</strong>
                    <span className="pill">
                      {schedule.is_working ? '근무' : '휴무'}
                      {schedule.is_weekend_work ? ' / 주말근무' : ''}
                    </span>
                  </div>

                  <div className="compact-text">
                    간략히보기: {schedule.is_working ? `${schedule.work_start || '-'} ~ ${schedule.work_end || '-'}` : '휴무'} / 가능시간 {slots.length}개
                  </div>

                  <div className="inline-actions wrap">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        setCollapsedSchedules((prev) => ({
                          ...prev,
                          [schedule.id]: !collapsed,
                        }))
                      }
                    >
                      {collapsed ? '상세히보기' : '간략히보기'}
                    </button>
                  </div>

                  {!collapsed ? (
                    <div className="detail-box">
                      <p><strong>코치:</strong> {coach?.name || '-'}</p>
                      <p><strong>근무상태:</strong> {schedule.is_working ? '근무' : '휴무'}</p>
                      <p><strong>주말근무:</strong> {schedule.is_weekend_work ? '예' : '아니오'}</p>
                      <p><strong>근무시간:</strong> {schedule.work_start || '-'} ~ {schedule.work_end || '-'}</p>
                      <p><strong>메모:</strong> {schedule.memo || '-'}</p>
                      <p><strong>가능시간:</strong> {slots.length > 0 ? slots.map((slot) => slot.slot_time).join(', ') : '없음'}</p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === '공지사항' && (
        <div className="card">
          <h2>공지 / 이벤트</h2>

          <div className="list-stack">
            {publishedNotices.map((notice) => {
              const collapsed = collapsedNotices[notice.id] ?? true
              return (
                <div key={notice.id} className="list-card">
                  <div className="list-card-top">
                    <strong>{notice.title}</strong>
                    <span className="pill">{notice.category}</span>
                  </div>

                  <div className="compact-text">
                    간략히보기: {notice.content?.slice(0, 40) || ''}
                    {notice.content?.length > 40 ? '...' : ''}
                  </div>

                  <div className="inline-actions wrap">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        setCollapsedNotices((prev) => ({
                          ...prev,
                          [notice.id]: !collapsed,
                        }))
                      }
                    >
                      {collapsed ? '상세히보기' : '간략히보기'}
                    </button>
                  </div>

                  {!collapsed ? (
                    <div className="detail-box">
                      <p><strong>내용:</strong> {notice.content || '-'}</p>
                      <p><strong>이미지 URL:</strong> {notice.image_url || '-'}</p>
                      <p><strong>영상 URL:</strong> {notice.video_url || '-'}</p>
                      <p><strong>기간:</strong> {notice.starts_at || '-'} ~ {notice.ends_at || '-'}</p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === '사용방법' && (
        <div className="card">
          <h2>{manual?.title || '사용방법'}</h2>
          <div className="detail-box">
            <pre className="pre-text">{manual?.content || '아직 등록된 사용방법이 없습니다.'}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
