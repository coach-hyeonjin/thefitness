import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'thefitness_app_v1'

const initialData = {
  members: [
    {
      id: 'm1',
      name: '김현진',
      goal: '체중 감량',
      totalSessions: 20,
      usedSessions: 8,
      startDate: '2026-01-15',
      endDate: '2026-04-15',
      memo: '무릎 부상 이력 있음. 저강도 하체 운동 위주 진행.',
    },
  ],
  brands: ['해머 스트렝스', '무브먼트', '파나타', 'IKK'],
  exercises: [
    { id: 'e1', name: '시티드 로우', bodyPart: '등', category: '웨이트', brand: '해머 스트렝스' },
    { id: 'e2', name: '랫풀다운', bodyPart: '등', category: '웨이트', brand: '파나타' },
    { id: 'e3', name: '벤치프레스', bodyPart: '가슴', category: '웨이트', brand: 'IKK' },
    { id: 'e4', name: '트레드밀 걷기', bodyPart: '하체', category: '유산소', brand: '무브먼트' },
  ],
  workouts: [],
}

const bodyPartOptions = ['가슴', '어깨', '팔', '등', '하체', '스트레칭&재활', '유산소']
const categoryOptions = ['웨이트', '유산소', '스트레칭&재활']

function getTodayString() {
  return new Date().toISOString().slice(0, 10)
}

function getFirstBrand(brands = []) {
  return brands[0] || '해머 스트렝스'
}

function createWorkoutItem(brands = []) {
  return {
    id: `wi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: '웨이트',
    bodyPart: '등',
    brand: getFirstBrand(brands),
    exerciseName: '',
    sets: [{ setNo: 1, kg: 0, reps: 0 }],
    goodPoint: '',
    improvePoint: '',
  }
}

function normalizeSets(sets = []) {
  return sets.map((setRow, index) => ({
    ...setRow,
    setNo: index + 1,
  }))
}

function makeMemberCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function MainDashboard({ user, profile, onLogout }) {
  const [data, setData] = useState(initialData)
  const [selectedMemberId, setSelectedMemberId] = useState(initialData.members[0]?.id || '')
  const [expandedWorkoutIds, setExpandedWorkoutIds] = useState([])

  const [memberForm, setMemberForm] = useState({
    name: '',
    goal: '',
    totalSessions: 20,
    usedSessions: 0,
    startDate: '',
    endDate: '',
    memo: '',
  })

  const [brandForm, setBrandForm] = useState('')
  const [exerciseForm, setExerciseForm] = useState({
    name: '',
    bodyPart: '등',
    category: '웨이트',
    brand: getFirstBrand(initialData.brands),
  })

  const [exerciseSearch, setExerciseSearch] = useState('')

  const [workoutDraft, setWorkoutDraft] = useState({
    date: getTodayString(),
    bodyParts: [],
    items: [createWorkoutItem(initialData.brands)],
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return

      const parsed = JSON.parse(saved)

      const safeMembers = Array.isArray(parsed.members)
        ? parsed.members.map((member) => ({
            accessCode: member.accessCode || makeMemberCode(),
            ...member,
          }))
        : initialData.members.map((member) => ({
            accessCode: member.accessCode || makeMemberCode(),
            ...member,
          }))

      const safeData = {
        members: safeMembers,
        brands:
          Array.isArray(parsed.brands) && parsed.brands.length > 0
            ? parsed.brands
            : initialData.brands,
        exercises: Array.isArray(parsed.exercises) ? parsed.exercises : initialData.exercises,
        workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
      }

      setData(safeData)
      setSelectedMemberId(safeData.members[0]?.id || '')

      setExerciseForm((prev) => ({
        ...prev,
        brand: getFirstBrand(safeData.brands),
      }))

      setWorkoutDraft((prev) => ({
        ...prev,
        items:
          prev.items?.length > 0
            ? prev.items.map((item) => ({
                ...item,
                brand: item.brand || getFirstBrand(safeData.brands),
              }))
            : [createWorkoutItem(safeData.brands)],
      }))
    } catch (e) {
      console.error('저장 데이터 불러오기 오류:', e)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('저장 오류:', e)
    }
  }, [data])

  useEffect(() => {
    if (!data.members.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(data.members[0]?.id || '')
    }
  }, [data.members, selectedMemberId])

  const selectedMember = useMemo(() => {
    return data.members.find((m) => m.id === selectedMemberId) || data.members[0] || null
  }, [data.members, selectedMemberId])

  const memberWorkouts = useMemo(() => {
    if (!selectedMember) return []
    return data.workouts.filter((w) => w.memberId === selectedMember.id)
  }, [data.workouts, selectedMember])

  const thisMonthCount = useMemo(() => {
    if (!selectedMember) return 0
    const month = workoutDraft.date.slice(0, 7)
    return memberWorkouts.filter((w) => (w.date || '').slice(0, 7) === month).length
  }, [memberWorkouts, workoutDraft.date, selectedMember])

  const filteredExercises = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase()
    if (!q) return data.exercises

    return data.exercises.filter((e) =>
      [e.name, e.bodyPart, e.category, e.brand].join(' ').toLowerCase().includes(q)
    )
  }, [data.exercises, exerciseSearch])

  const progress = selectedMember
    ? Math.round((selectedMember.usedSessions / Math.max(selectedMember.totalSessions, 1)) * 100)
    : 0

  function addMember() {
    if (!memberForm.name.trim()) return

    const id = `m-${Date.now()}`
    const newMember = {
      ...memberForm,
      id,
      accessCode: makeMemberCode(),
      totalSessions: Number(memberForm.totalSessions) || 0,
      usedSessions: Number(memberForm.usedSessions) || 0,
    }

    setData((prev) => ({
      ...prev,
      members: [newMember, ...prev.members],
    }))

    setSelectedMemberId(id)

    setMemberForm({
      name: '',
      goal: '',
      totalSessions: 20,
      usedSessions: 0,
      startDate: '',
      endDate: '',
      memo: '',
    })
  }

  function deleteMember(memberId) {
    const ok = window.confirm('이 회원을 삭제할까요?')
    if (!ok) return

    setData((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== memberId),
      workouts: prev.workouts.filter((w) => w.memberId !== memberId),
    }))

    if (selectedMemberId === memberId) {
      setSelectedMemberId('')
    }
  }

  function addBrand() {
    const value = brandForm.trim()
    if (!value) return
    if (data.brands.includes(value)) return

    setData((prev) => ({
      ...prev,
      brands: [...prev.brands, value],
    }))

    setExerciseForm((prev) => ({
      ...prev,
      brand: value,
    }))

    setBrandForm('')
  }

  function addExercise() {
    if (!exerciseForm.name.trim()) return

    const exists = data.exercises.some(
      (e) =>
        e.name === exerciseForm.name &&
        e.bodyPart === exerciseForm.bodyPart &&
        e.category === exerciseForm.category &&
        e.brand === exerciseForm.brand
    )

    if (exists) return

    const newExercise = {
      ...exerciseForm,
      id: `e-${Date.now()}`,
    }

    setData((prev) => ({
      ...prev,
      exercises: [newExercise, ...prev.exercises],
    }))

    setExerciseForm({
      name: '',
      bodyPart: '등',
      category: '웨이트',
      brand: getFirstBrand(data.brands),
    })
  }

  function toggleBodyPart(part) {
    setWorkoutDraft((prev) => ({
      ...prev,
      bodyParts: prev.bodyParts.includes(part)
        ? prev.bodyParts.filter((p) => p !== part)
        : [...prev.bodyParts, part],
    }))
  }

  function addWorkoutItem() {
    setWorkoutDraft((prev) => ({
      ...prev,
      items: [...prev.items, createWorkoutItem(data.brands)],
    }))
  }

  function removeWorkoutItem(index) {
    setWorkoutDraft((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  function updateWorkoutItem(index, patch) {
    setWorkoutDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  function addSet(itemIndex) {
    setWorkoutDraft((prev) => ({
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

  function removeSet(itemIndex, setIndex) {
    setWorkoutDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== itemIndex) return item

        const nextSets = item.sets.filter((_, j) => j !== setIndex)
        return {
          ...item,
          sets: nextSets.length > 0 ? normalizeSets(nextSets) : [{ setNo: 1, kg: 0, reps: 0 }],
        }
      }),
    }))
  }

  function updateSet(itemIndex, setIndex, key, value) {
    setWorkoutDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              sets: item.sets.map((setItem, j) =>
                j === setIndex ? { ...setItem, [key]: Number(value) || 0 } : setItem
              ),
            }
          : item
      ),
    }))
  }

  function applyExercise(itemIndex, exercise) {
    updateWorkoutItem(itemIndex, {
      exerciseName: exercise.name,
      bodyPart: exercise.bodyPart,
      category: exercise.category,
      brand: exercise.brand,
    })
  }

  function saveWorkout() {
    if (!selectedMember) return

    const cleanedItems = workoutDraft.items
      .filter((item) => item.exerciseName.trim())
      .map((item) => ({
        ...item,
        sets: normalizeSets(item.sets.filter((s) => Number(s.kg) || Number(s.reps) || Number(s.setNo))),
      }))

    if (cleanedItems.length === 0) {
      alert('운동명을 1개 이상 입력해 주세요.')
      return
    }

    const newWorkout = {
      id: `w-${Date.now()}`,
      memberId: selectedMember.id,
      date: workoutDraft.date,
      bodyParts: workoutDraft.bodyParts,
      items: cleanedItems,
    }

    setData((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === selectedMember.id
          ? { ...m, usedSessions: Math.min(m.totalSessions, (m.usedSessions || 0) + 1) }
          : m
      ),
      workouts: [newWorkout, ...prev.workouts],
    }))

    setWorkoutDraft({
      date: getTodayString(),
      bodyParts: [],
      items: [createWorkoutItem(data.brands)],
    })
  }

  function deleteWorkout(workoutId) {
    const target = data.workouts.find((w) => w.id === workoutId)
    if (!target) return

    const ok = window.confirm('이 운동 기록을 삭제할까요?')
    if (!ok) return

    setData((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === target.memberId
          ? { ...m, usedSessions: Math.max((m.usedSessions || 0) - 1, 0) }
          : m
      ),
      workouts: prev.workouts.filter((w) => w.id !== workoutId),
    }))
  }

  function toggleWorkoutDetail(workoutId) {
    setExpandedWorkoutIds((prev) =>
      prev.includes(workoutId)
        ? prev.filter((id) => id !== workoutId)
        : [...prev, workoutId]
    )
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
      alert('복사 완료')
    } catch (e) {
      alert('복사 실패')
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            gap: 8,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>더피트니스 화정점</h2>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {profile?.teacher_name || profile?.name || user?.email || '관리자'}
            </div>
          </div>
          <button className="secondary-btn" onClick={onLogout}>
            로그아웃
          </button>
        </div>

        <div className="form-block">
          <input
            placeholder="회원 이름"
            value={memberForm.name}
            onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
          />
          <input
            placeholder="목표"
            value={memberForm.goal}
            onChange={(e) => setMemberForm({ ...memberForm, goal: e.target.value })}
          />
          <div className="grid-2">
            <input
              type="number"
              placeholder="총 세션"
              value={memberForm.totalSessions}
              onChange={(e) => setMemberForm({ ...memberForm, totalSessions: e.target.value })}
            />
            <input
              type="number"
              placeholder="사용 세션"
              value={memberForm.usedSessions}
              onChange={(e) => setMemberForm({ ...memberForm, usedSessions: e.target.value })}
            />
          </div>
          <div className="grid-2">
            <input
              type="date"
              value={memberForm.startDate}
              onChange={(e) => setMemberForm({ ...memberForm, startDate: e.target.value })}
            />
            <input
              type="date"
              value={memberForm.endDate}
              onChange={(e) => setMemberForm({ ...memberForm, endDate: e.target.value })}
            />
          </div>
          <textarea
            placeholder="메모"
            value={memberForm.memo}
            onChange={(e) => setMemberForm({ ...memberForm, memo: e.target.value })}
          />
          <button className="primary-btn" onClick={addMember}>
            회원 추가
          </button>
        </div>

        <div className="member-list">
          {data.members.map((member) => (
            <div
              key={member.id}
              className={`member-item ${selectedMemberId === member.id ? 'active' : ''}`}
              onClick={() => setSelectedMemberId(member.id)}
            >
              <div className="member-name">{member.name}</div>
              <div className="member-goal">{member.goal || '목표 미입력'}</div>
              <div className="member-session">
                {member.usedSessions} / {member.totalSessions}회
              </div>
              <div className="button-row" style={{ marginTop: 10 }}>
                <button
                  className="danger-btn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteMember(member.id)
                  }}
                >
                  회원 삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="main">
        <section className="top-grid">
          <div className="card">
            <h2>회원 정보</h2>
            {selectedMember ? (
              <>
                <div className="member-header">
                  <div>
                    <div className="title-lg">{selectedMember.name}</div>
                    <div className="pill">목표: {selectedMember.goal || '미입력'}</div>
                  </div>
                  <div className="session-big">
                    {selectedMember.usedSessions} / {selectedMember.totalSessions}회
                  </div>
                </div>

                <div className="progress-wrap">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="muted">
                    남은 세션: {Math.max(selectedMember.totalSessions - selectedMember.usedSessions, 0)}회
                  </div>
                </div>

                <div className="grid-2 stat-grid">
                  <div className="soft-card green">
                    <div className="muted">이번달 총 운동</div>
                    <div className="stat-number">{thisMonthCount}회</div>
                  </div>
                  <div className="soft-card">
                    <div className="date-row">
                      <div>
                        <div className="muted">시작일</div>
                        <div className="date-val">{selectedMember.startDate || '-'}</div>
                      </div>
                      <div>
                        <div className="muted">종료일</div>
                        <div className="date-val">{selectedMember.endDate || '-'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="memo-box">
                  <div className="memo-title">특이사항 / 메모</div>
                  <div>{selectedMember.memo || '메모 없음'}</div>
                </div>

                <div className="member-link-box">
                  <div className="memo-title">회원 링크 / 코드</div>
                  <div className="link-line">
                    링크: {`${window.location.origin}?member=${selectedMember.id}`}
                  </div>
                  <div className="link-line">
                    코드: <strong>{selectedMember.accessCode || '-'}</strong>
                  </div>
                  <div className="button-row">
                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={() => copyText(`${window.location.origin}?member=${selectedMember.id}`)}
                    >
                      링크 복사
                    </button>
                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={() => copyText(selectedMember.accessCode || '')}
                    >
                      코드 복사
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>회원을 추가해 주세요.</div>
            )}
          </div>

          <div className="card">
            <h2>운동 DB / 브랜드 관리</h2>

            <div className="form-block">
              <input
                placeholder="브랜드 이름 추가"
                value={brandForm}
                onChange={(e) => setBrandForm(e.target.value)}
              />
              <button className="secondary-btn" onClick={addBrand}>
                브랜드 추가
              </button>
            </div>

            <div className="form-block">
              <input
                placeholder="운동명"
                value={exerciseForm.name}
                onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })}
              />
              <div className="grid-3">
                <select
                  value={exerciseForm.bodyPart}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, bodyPart: e.target.value })}
                >
                  {bodyPartOptions.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                <select
                  value={exerciseForm.category}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, category: e.target.value })}
                >
                  {categoryOptions.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                <select
                  value={exerciseForm.brand}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, brand: e.target.value })}
                >
                  {data.brands.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <button className="secondary-btn" onClick={addExercise}>
                운동 추가
              </button>
            </div>

            <input
              placeholder="운동 검색"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
            />

            <div className="exercise-list">
              {filteredExercises.map((exercise) => (
                <div className="exercise-item" key={exercise.id}>
                  <div className="exercise-name">{exercise.name}</div>
                  <div className="tag-row">
                    <span className="tag">{exercise.bodyPart}</span>
                    <span className="tag">{exercise.category}</span>
                    <span className="tag">{exercise.brand}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <h2>운동 기록 작성</h2>

          <div className="grid-2">
            <div>
              <label>날짜</label>
              <input
                type="date"
                value={workoutDraft.date}
                onChange={(e) => setWorkoutDraft({ ...workoutDraft, date: e.target.value })}
              />
            </div>
            <div>
              <label>운동 부위</label>
              <div className="bodypart-wrap">
                {bodyPartOptions.map((part) => (
                  <button
                    type="button"
                    key={part}
                    className={`part-btn ${workoutDraft.bodyParts.includes(part) ? 'on' : ''}`}
                    onClick={() => toggleBodyPart(part)}
                  >
                    {part}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="section-head">
            <h3>운동 목록</h3>
            <button className="secondary-btn" onClick={addWorkoutItem}>
              + 운동 추가
            </button>
          </div>

          {workoutDraft.items.map((item, itemIndex) => (
            <div className="workout-card" key={item.id}>
              <div className="workout-card-head">
                <strong>운동 {itemIndex + 1}</strong>
                {workoutDraft.items.length > 1 && (
                  <button className="danger-btn" onClick={() => removeWorkoutItem(itemIndex)}>
                    삭제
                  </button>
                )}
              </div>

              <div className="grid-3">
                <select
                  value={item.category}
                  onChange={(e) => updateWorkoutItem(itemIndex, { category: e.target.value })}
                >
                  {categoryOptions.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                <select
                  value={item.bodyPart}
                  onChange={(e) => updateWorkoutItem(itemIndex, { bodyPart: e.target.value })}
                >
                  {bodyPartOptions.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                <select
                  value={item.brand}
                  onChange={(e) => updateWorkoutItem(itemIndex, { brand: e.target.value })}
                >
                  {data.brands.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>

              <input
                placeholder="운동명 입력"
                value={item.exerciseName}
                onChange={(e) => updateWorkoutItem(itemIndex, { exerciseName: e.target.value })}
              />

              <div className="mini-ex-list">
                {filteredExercises
                  .filter((exercise) => {
                    const bodyPartMatch = !item.bodyPart || exercise.bodyPart === item.bodyPart
                    const categoryMatch = !item.category || exercise.category === item.category
                    return bodyPartMatch && categoryMatch
                  })
                  .slice(0, 6)
                  .map((exercise) => (
                    <button
                      type="button"
                      key={exercise.id}
                      className="mini-ex-item"
                      onClick={() => applyExercise(itemIndex, exercise)}
                    >
                      {exercise.name} · {exercise.brand}
                    </button>
                  ))}
              </div>

              <div className="set-table">
                <div className="set-head">
                  <span>세트</span>
                  <span>무게(kg)</span>
                  <span>횟수(reps)</span>
                  <span>관리</span>
                </div>

                {item.sets.map((setRow, setIndex) => (
                  <div className="set-row" key={`${item.id}-${setIndex}`}>
                    <input
                      type="number"
                      value={setRow.setNo}
                      onChange={(e) => updateSet(itemIndex, setIndex, 'setNo', e.target.value)}
                    />
                    <input
                      type="number"
                      value={setRow.kg}
                      onChange={(e) => updateSet(itemIndex, setIndex, 'kg', e.target.value)}
                    />
                    <input
                      type="number"
                      value={setRow.reps}
                      onChange={(e) => updateSet(itemIndex, setIndex, 'reps', e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => addSet(itemIndex)}
                      >
                        + 세트
                      </button>
                      {item.sets.length > 1 && (
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => removeSet(itemIndex, setIndex)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid-2">
                <textarea
                  placeholder="잘한 점"
                  value={item.goodPoint}
                  onChange={(e) => updateWorkoutItem(itemIndex, { goodPoint: e.target.value })}
                />
                <textarea
                  placeholder="보완할 점"
                  value={item.improvePoint}
                  onChange={(e) => updateWorkoutItem(itemIndex, { improvePoint: e.target.value })}
                />
              </div>
            </div>
          ))}

          <div className="save-row">
            <button className="primary-btn" onClick={saveWorkout}>
              기록 저장
            </button>
          </div>
        </section>

        <section className="card">
          <h2>기록 내역</h2>
          {memberWorkouts.length === 0 ? (
            <div className="muted">저장된 기록이 없습니다.</div>
          ) : (
            <div className="history-list">
              {memberWorkouts.map((workout) => {
                const isExpanded = expandedWorkoutIds.includes(workout.id)
                const exerciseCount = workout.items?.length || 0
                const totalSets =
                  workout.items?.reduce((sum, item) => sum + (item.sets?.length || 0), 0) || 0

                return (
                  <div className="history-card" key={workout.id}>
                    <div className="history-head">
                      <div>
                        <strong>{workout.date}</strong>
                        <div className="tag-row" style={{ marginTop: 8 }}>
                          {(workout.bodyParts || []).map((part) => (
                            <span className="tag" key={part}>
                              {part}
                            </span>
                          ))}
                        </div>
                        <div className="muted" style={{ marginTop: 8 }}>
                          요약: 운동 {exerciseCount}개 / 총 {totalSets}세트
                        </div>
                      </div>

                      <div className="button-row">
                        <button
                          className="secondary-btn"
                          type="button"
                          onClick={() => toggleWorkoutDetail(workout.id)}
                        >
                          {isExpanded ? '상세 닫기' : '상세 보기'}
                        </button>
                        <button
                          className="danger-btn"
                          type="button"
                          onClick={() => deleteWorkout(workout.id)}
                        >
                          기록 삭제
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="history-list" style={{ marginTop: 12 }}>
                        {workout.items.map((item) => (
                          <div className="history-item" key={item.id}>
                            <div className="exercise-name">{item.exerciseName}</div>
                            <div className="tag-row">
                              <span className="tag">{item.category}</span>
                              <span className="tag">{item.bodyPart}</span>
                              <span className="tag">{item.brand}</span>
                            </div>
                            <div className="history-sets">
                              {item.sets.map((s, idx) => (
                                <div className="set-box" key={idx}>
                                  {s.setNo}세트 · {s.kg}kg · {s.reps}회
                                </div>
                              ))}
                            </div>
                            <div className="grid-2">
                              <div className="feedback good">✅ {item.goodPoint || '-'}</div>
                              <div className="feedback warn">⚠️ {item.improvePoint || '-'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
