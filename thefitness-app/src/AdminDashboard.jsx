import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import './style.css'

const bodyPartOptions = ['가슴', '어깨', '팔', '등', '하체', '스트레칭&재활', '유산소']
const categoryOptions = ['웨이트', '유산소', '스트레칭&재활']
const adminTabs = ['회원', '기록작성', '운동DB', '통계', '사용방법']
const routineDays = [
  { dayKey: 'mon', dayLabel: '월요일' },
  { dayKey: 'tue', dayLabel: '화요일' },
  { dayKey: 'wed', dayLabel: '수요일' },
  { dayKey: 'thu', dayLabel: '목요일' },
  { dayKey: 'fri', dayLabel: '금요일' },
  { dayKey: 'sat', dayLabel: '토요일' },
  { dayKey: 'sun', dayLabel: '일요일' },
]

function makeAccessCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function getKoreaDateString() {
  const now = new Date()
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return korea.toISOString().slice(0, 10)
}

function normalizeSetNumbers(sets = []) {
  return sets.map((setRow, index) => ({
    ...setRow,
    setNo: index + 1,
  }))
}

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

function createDefaultRoutineRows() {
  return routineDays.map((day, index) => ({
    id: `routine-${day.dayKey}-${index}`,
    dayKey: day.dayKey,
    dayLabel: day.dayLabel,
    title: '',
    exercisesText: '',
  }))
}

export default function AdminDashboard({ user, profile, onLogout }) {
  const getDefaultBrandName = (brandRows = []) => {
    if (!brandRows || brandRows.length === 0) return '기본'
    if (brandRows.some((brand) => brand.name === '기본')) return '기본'
    return brandRows[0]?.name || '기본'
  }

  const createWorkoutItem = (defaultBrand = '기본') => ({
    id: `wi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: '웨이트',
    bodyPart: '등',
    brand: defaultBrand,
    exerciseName: '',
    sets: [{ setNo: 1, kg: 0, reps: 0 }],
    goodPoint: '',
    improvePoint: '',
  })

  const [activeTab, setActiveTab] = useState('회원')

  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [selectedMemberId, setSelectedMemberId] = useState('')

  const [brands, setBrands] = useState([])
  const [loadingBrands, setLoadingBrands] = useState(false)
  const [brandForm, setBrandForm] = useState('')

  const [exercises, setExercises] = useState([])
  const [loadingExercises, setLoadingExercises] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')

  const [workoutHistory, setWorkoutHistory] = useState([])
  const [editingWorkoutId, setEditingWorkoutId] = useState(null)
  const [expandedWorkoutIds, setExpandedWorkoutIds] = useState([])

  const [memberForm, setMemberForm] = useState({
    name: '',
    goal: '',
    total_sessions: 20,
    used_sessions: 0,
    start_date: '',
    end_date: '',
    memo: '',
  })

  const [editMemberId, setEditMemberId] = useState(null)
  const [editMemberForm, setEditMemberForm] = useState({
    name: '',
    goal: '',
    total_sessions: 20,
    start_date: '',
    end_date: '',
    memo: '',
  })

  const [exerciseForm, setExerciseForm] = useState({
    name: '',
    bodyPart: '등',
    category: '웨이트',
    brand: '기본',
  })

  const [editExerciseId, setEditExerciseId] = useState('')
  const [editExerciseForm, setEditExerciseForm] = useState({
    name: '',
    bodyPart: '등',
    category: '웨이트',
    brand: '기본',
  })

  const [editBrandId, setEditBrandId] = useState('')
  const [editBrandForm, setEditBrandForm] = useState({ name: '' })

  const [workoutDraft, setWorkoutDraft] = useState({
    date: getKoreaDateString(),
    bodyParts: [],
    items: [createWorkoutItem('기본')],
  })

  const [routineRows, setRoutineRows] = useState(createDefaultRoutineRows())
  const [loadingRoutines, setLoadingRoutines] = useState(false)
  const [savingRoutines, setSavingRoutines] = useState(false)

  const [manualTitle, setManualTitle] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [loadingManual, setLoadingManual] = useState(false)
  const [savingManual, setSavingManual] = useState(false)

  const resetWorkoutDraft = (brandRows = brands) => {
    setWorkoutDraft({
      date: getKoreaDateString(),
      bodyParts: [],
      items: [createWorkoutItem(getDefaultBrandName(brandRows))],
    })
    setEditingWorkoutId(null)
  }

  const resetMemberForm = () => {
    setMemberForm({
      name: '',
      goal: '',
      total_sessions: 20,
      used_sessions: 0,
      start_date: '',
      end_date: '',
      memo: '',
    })
  }

  const resetExerciseForm = (brandRows = brands) => {
    setExerciseForm({
      name: '',
      bodyPart: '등',
      category: '웨이트',
      brand: getDefaultBrandName(brandRows),
    })
  }

  const loadMembers = async () => {
    setLoadingMembers(true)

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      alert(`회원 목록 불러오기 오류: ${error.message}`)
      setLoadingMembers(false)
      return
    }

    const rows = data || []
    setMembers(rows)

    if (!selectedMemberId && rows.length > 0) setSelectedMemberId(rows[0].id)
    if (selectedMemberId && !rows.find((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(rows[0]?.id || '')
    }

    setLoadingMembers(false)
  }

  const loadBrands = async () => {
    setLoadingBrands(true)

    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      alert(`브랜드 불러오기 오류: ${error.message}`)
      setLoadingBrands(false)
      return
    }

    setBrands(data || [])
    setLoadingBrands(false)
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

  const loadManual = async () => {
    setLoadingManual(true)

    const { data, error } = await supabase
      .from('app_manuals')
      .select('*')
      .eq('manual_key', 'common')
      .maybeSingle()

    if (error) {
      alert(`메뉴얼 불러오기 오류: ${error.message}`)
      setLoadingManual(false)
      return
    }

    setManualTitle(data?.title || '더피트니스 화정점 사용방법')
    setManualContent(data?.content || '')
    setLoadingManual(false)
  }

  const loadWorkoutHistory = async (memberId) => {
    if (!memberId) {
      setWorkoutHistory([])
      return
    }

    const { data, error } = await supabase
      .from('workouts')
      .select(`
        *,
        workout_items (*)
      `)
      .eq('member_id', memberId)
      .order('workout_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      alert(`운동 기록 불러오기 오류: ${error.message}`)
      return
    }

    setWorkoutHistory(data || [])
  }

  const loadMemberRoutines = async (memberId) => {
    if (!memberId) {
      setRoutineRows(createDefaultRoutineRows())
      return
    }

    setLoadingRoutines(true)

    const { data, error } = await supabase
      .from('member_routines')
      .select('*')
      .eq('member_id', memberId)
      .order('sort_order', { ascending: true })

    if (error) {
      setLoadingRoutines(false)
      alert(`루틴 불러오기 오류: ${error.message}`)
      return
    }

    const defaults = createDefaultRoutineRows()
    const map = new Map((data || []).map((row) => [row.day_key, row]))

    const merged = defaults.map((day) => {
      const saved = map.get(day.dayKey)
      return {
        ...day,
        title: saved?.title || '',
        exercisesText: Array.isArray(saved?.exercises) ? saved.exercises.join(', ') : '',
      }
    })

    setRoutineRows(merged)
    setLoadingRoutines(false)
  }

  const syncMemberSessionCount = async (memberId) => {
    if (!memberId) return null

    const { count, error } = await supabase
      .from('workouts')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('workout_type', 'pt')

    if (error) {
      alert(`세션 동기화 오류: ${error.message}`)
      return null
    }

    const usedCount = count || 0

    const { error: updateError } = await supabase
      .from('members')
      .update({ used_sessions: usedCount })
      .eq('id', memberId)

    if (updateError) {
      alert(`세션 업데이트 오류: ${updateError.message}`)
      return null
    }

    return usedCount
  }

  useEffect(() => {
    loadMembers()
    loadBrands()
    loadExercises()
    loadManual()
  }, [])

  useEffect(() => {
    loadWorkoutHistory(selectedMemberId)
    loadMemberRoutines(selectedMemberId)
    resetWorkoutDraft()
  }, [selectedMemberId])

  useEffect(() => {
    const defaultBrand = getDefaultBrandName(brands)

    setExerciseForm((prev) => ({
      ...prev,
      brand: prev.brand || defaultBrand,
    }))

    setEditExerciseForm((prev) => ({
      ...prev,
      brand: prev.brand || defaultBrand,
    }))

    setWorkoutDraft((prev) => ({
      ...prev,
      items:
        prev.items?.length > 0
          ? prev.items.map((item) => ({
              ...item,
              brand: item.brand || defaultBrand,
            }))
          : [createWorkoutItem(defaultBrand)],
    }))
  }, [brands])

  const selectedMember = useMemo(() => {
    return members.find((m) => m.id === selectedMemberId) || null
  }, [members, selectedMemberId])

  const brandNames = useMemo(() => {
    if (brands.length === 0) return ['기본']
    return brands.map((b) => b.name)
  }, [brands])

  const filteredExercises = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase()
    if (!q) return exercises

    return exercises.filter((e) =>
      [e.name, e.body_part, e.category, e.brand_name].join(' ').toLowerCase().includes(q)
    )
  }, [exercises, exerciseSearch])

  const progress = selectedMember
    ? Math.round((selectedMember.used_sessions / Math.max(selectedMember.total_sessions, 1)) * 100)
    : 0

  const currentMonth = getKoreaDateString().slice(0, 7)
  const currentMonthHistory = workoutHistory.filter((w) => (w.workout_date || '').slice(0, 7) === currentMonth)
  const currentMonthPtCount = currentMonthHistory.filter((w) => (w.workout_type || 'pt') === 'pt').length
  const currentMonthSelfCount = currentMonthHistory.filter((w) => (w.workout_type || 'pt') === 'self').length
  const currentMonthTotal = currentMonthHistory.length

  const toggleWorkoutDetail = (workoutId) => {
    setExpandedWorkoutIds((prev) =>
      prev.includes(workoutId)
        ? prev.filter((id) => id !== workoutId)
        : [...prev, workoutId]
    )
  }

  const addMember = async () => {
    if (!memberForm.name.trim()) {
      alert('회원 이름을 입력해 주세요.')
      return
    }

    const accessCode = makeAccessCode()

    const { error } = await supabase.from('members').insert([
      {
        teacher_id: user.id,
        name: memberForm.name.trim(),
        goal: memberForm.goal,
        total_sessions: Number(memberForm.total_sessions) || 0,
        used_sessions: 0,
        start_date: memberForm.start_date || null,
        end_date: memberForm.end_date || null,
        memo: memberForm.memo,
        access_code: accessCode,
      },
    ])

    if (error) {
      alert(`회원 추가 오류: ${error.message}`)
      return
    }

    resetMemberForm()
    await loadMembers()
  }

  const openMemberEdit = (member) => {
    setEditMemberId(member.id)
    setEditMemberForm({
      name: member.name || '',
      goal: member.goal || '',
      total_sessions: member.total_sessions || 20,
      start_date: member.start_date || '',
      end_date: member.end_date || '',
      memo: member.memo || '',
    })
    setActiveTab('회원')
  }

  const closeMemberEdit = () => {
    setEditMemberId(null)
    setEditMemberForm({
      name: '',
      goal: '',
      total_sessions: 20,
      start_date: '',
      end_date: '',
      memo: '',
    })
  }

  const updateMember = async () => {
    if (!editMemberId || !editMemberForm.name.trim()) {
      alert('회원 이름을 입력해 주세요.')
      return
    }

    const { error } = await supabase
      .from('members')
      .update({
        name: editMemberForm.name.trim(),
        goal: editMemberForm.goal,
        total_sessions: Number(editMemberForm.total_sessions) || 0,
        start_date: editMemberForm.start_date || null,
        end_date: editMemberForm.end_date || null,
        memo: editMemberForm.memo,
      })
      .eq('id', editMemberId)
      .eq('teacher_id', user.id)

    if (error) {
      alert(`회원 수정 오류: ${error.message}`)
      return
    }

    await syncMemberSessionCount(editMemberId)
    await loadMembers()
    closeMemberEdit()
  }

  const deleteMember = async (memberId) => {
    if (!window.confirm('정말 이 회원을 삭제할까요?')) return

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', memberId)
      .eq('teacher_id', user.id)

    if (error) {
      alert(`회원 삭제 오류: ${error.message}`)
      return
    }

    if (selectedMemberId === memberId) setSelectedMemberId('')
    if (editMemberId === memberId) closeMemberEdit()

    await loadMembers()
  }

  const addBrand = async () => {
    const value = brandForm.trim()
    if (!value) {
      alert('브랜드 이름을 입력해 주세요.')
      return
    }

    const duplicate = brands.some((brand) => brand.name === value)
    if (duplicate) {
      alert('이미 등록된 브랜드입니다.')
      return
    }

    const { error } = await supabase.from('brands').insert([
      { name: value, sort_order: brands.length + 1 },
    ])

    if (error) {
      alert(`브랜드 추가 오류: ${error.message}`)
      return
    }

    setBrandForm('')
    await loadBrands()
  }

  const openBrandEdit = (brand) => {
    setEditBrandId(brand.id)
    setEditBrandForm({ name: brand.name })
    setActiveTab('운동DB')
  }

  const closeBrandEdit = () => {
    setEditBrandId('')
    setEditBrandForm({ name: '' })
  }

  const updateBrand = async () => {
    const newBrand = editBrandForm.name.trim()

    if (!editBrandId || !newBrand) {
      alert('브랜드 이름을 입력해 주세요.')
      return
    }

    const oldBrand = brands.find((b) => b.id === editBrandId)
    if (!oldBrand) return

    const duplicate = brands.some((brand) => brand.id !== editBrandId && brand.name === newBrand)
    if (duplicate) {
      alert('같은 브랜드명이 이미 있습니다.')
      return
    }

    const { error } = await supabase
      .from('brands')
      .update({ name: newBrand })
      .eq('id', editBrandId)

    if (error) {
      alert(`브랜드 수정 오류: ${error.message}`)
      return
    }

    if (oldBrand.name !== newBrand) {
      const { error: exError } = await supabase
        .from('exercises')
        .update({ brand_name: newBrand })
        .eq('brand_name', oldBrand.name)

      if (exError) {
        alert(`운동 브랜드명 동기화 오류: ${exError.message}`)
        return
      }
    }

    await loadBrands()
    await loadExercises()
    closeBrandEdit()
  }

  const deleteBrand = async (brand) => {
    if (brand.name === '기본') {
      alert('기본 브랜드는 삭제할 수 없습니다.')
      return
    }

    if (!window.confirm(`"${brand.name}" 브랜드를 삭제할까요?\n연결된 운동은 "기본" 브랜드로 바뀝니다.`)) return

    const { error: exError } = await supabase
      .from('exercises')
      .update({ brand_name: '기본' })
      .eq('brand_name', brand.name)

    if (exError) {
      alert(`운동 브랜드 변경 오류: ${exError.message}`)
      return
    }

    const { error } = await supabase.from('brands').delete().eq('id', brand.id)

    if (error) {
      alert(`브랜드 삭제 오류: ${error.message}`)
      return
    }

    await loadBrands()
    await loadExercises()

    if (editBrandId === brand.id) closeBrandEdit()
  }

  const addExercise = async () => {
    if (!exerciseForm.name.trim()) {
      alert('운동명을 입력해 주세요.')
      return
    }

    const duplicate = exercises.some(
      (exercise) =>
        exercise.name === exerciseForm.name.trim() &&
        exercise.body_part === exerciseForm.bodyPart &&
        exercise.category === exerciseForm.category &&
        exercise.brand_name === (exerciseForm.brand || getDefaultBrandName(brands))
    )

    if (duplicate) {
      alert('같은 조건의 운동이 이미 있습니다.')
      return
    }

    const { error } = await supabase.from('exercises').insert([
      {
        name: exerciseForm.name.trim(),
        body_part: exerciseForm.bodyPart,
        category: exerciseForm.category,
        brand_name: exerciseForm.brand || getDefaultBrandName(brands),
        sort_order: exercises.length + 1,
      },
    ])

    if (error) {
      alert(`운동 추가 오류: ${error.message}`)
      return
    }

    resetExerciseForm()
    await loadExercises()
  }

  const openExerciseEdit = (exercise) => {
    setEditExerciseId(exercise.id)
    setEditExerciseForm({
      name: exercise.name || '',
      bodyPart: exercise.body_part || '등',
      category: exercise.category || '웨이트',
      brand: exercise.brand_name || getDefaultBrandName(brands),
    })
    setActiveTab('운동DB')
  }

  const closeExerciseEdit = () => {
    setEditExerciseId('')
    setEditExerciseForm({
      name: '',
      bodyPart: '등',
      category: '웨이트',
      brand: getDefaultBrandName(brands),
    })
  }

  const updateExercise = async () => {
    if (!editExerciseId || !editExerciseForm.name.trim()) {
      alert('운동명을 입력해 주세요.')
      return
    }

    const duplicate = exercises.some(
      (exercise) =>
        exercise.id !== editExerciseId &&
        exercise.name === editExerciseForm.name.trim() &&
        exercise.body_part === editExerciseForm.bodyPart &&
        exercise.category === editExerciseForm.category &&
        exercise.brand_name === (editExerciseForm.brand || getDefaultBrandName(brands))
    )

    if (duplicate) {
      alert('같은 조건의 운동이 이미 있습니다.')
      return
    }

    const { error } = await supabase
      .from('exercises')
      .update({
        name: editExerciseForm.name.trim(),
        body_part: editExerciseForm.bodyPart,
        category: editExerciseForm.category,
        brand_name: editExerciseForm.brand || getDefaultBrandName(brands),
      })
      .eq('id', editExerciseId)

    if (error) {
      alert(`운동 수정 오류: ${error.message}`)
      return
    }

    await loadExercises()
    closeExerciseEdit()
  }

  const deleteExercise = async (exerciseId) => {
    if (!window.confirm('이 운동을 삭제할까요?')) return

    const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)

    if (error) {
      alert(`운동 삭제 오류: ${error.message}`)
      return
    }

    await loadExercises()

    if (editExerciseId === exerciseId) closeExerciseEdit()
  }

  const toggleBodyPart = (part) => {
    setWorkoutDraft((prev) => ({
      ...prev,
      bodyParts: prev.bodyParts.includes(part)
        ? prev.bodyParts.filter((p) => p !== part)
        : [...prev.bodyParts, part],
    }))
  }

  const addWorkoutItem = () => {
    setWorkoutDraft((prev) => ({
      ...prev,
      items: [...prev.items, createWorkoutItem(getDefaultBrandName(brands))],
    }))
  }

  const removeWorkoutItem = (index) => {
    setWorkoutDraft((prev) => ({
      ...prev,
      items:
        prev.items.length <= 1
          ? prev.items
          : prev.items.filter((_, i) => i !== index),
    }))
  }

  const updateWorkoutItem = (index, patch) => {
    setWorkoutDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const addSet = (itemIndex) => {
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

  const removeSet = (itemIndex, setIndex) => {
    setWorkoutDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== itemIndex) return item
        if (item.sets.length <= 1) return item
        const nextSets = item.sets.filter((_, j) => j !== setIndex)
        return { ...item, sets: normalizeSetNumbers(nextSets) }
      }),
    }))
  }

  const updateSet = (itemIndex, setIndex, key, value) => {
    setWorkoutDraft((prev) => ({
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

  const applyExercise = (itemIndex, exercise) => {
    updateWorkoutItem(itemIndex, {
      exerciseName: exercise.name,
      bodyPart: exercise.body_part,
      category: exercise.category,
      brand: exercise.brand_name,
    })
  }

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('복사 완료')
    } catch {
      alert('복사 실패')
    }
  }

  const saveWorkoutRecord = async () => {
    if (!selectedMemberId) {
      alert('회원을 먼저 선택하세요.')
      return
    }

    if (workoutDraft.items.length === 0) {
      alert('운동 항목이 없습니다.')
      return
    }

    const hasEmptyExercise = workoutDraft.items.some((item) => !item.exerciseName.trim())
    if (hasEmptyExercise) {
      alert('운동명을 입력해 주세요.')
      return
    }

    const { data: workoutData, error: workoutError } = await supabase
      .from('workouts')
      .insert([
        {
          member_id: selectedMemberId,
          workout_date: workoutDraft.date,
          body_parts: workoutDraft.bodyParts,
          workout_type: 'pt',
        },
      ])
      .select()
      .single()

    if (workoutError) {
      alert(`운동 저장 오류: ${workoutError.message}`)
      return
    }

    const itemRows = workoutDraft.items.flatMap((item) =>
      item.sets.map((setRow, index) => ({
        workout_id: workoutData.id,
        category: item.category,
        body_part: item.bodyPart,
        brand: item.brand,
        exercise_name: item.exerciseName,
        set_no: index + 1,
        kg: Number(setRow.kg) || 0,
        reps: Number(setRow.reps) || 0,
        good_point: item.goodPoint,
        improve_point: item.improvePoint,
      }))
    )

    const { error: itemError } = await supabase.from('workout_items').insert(itemRows)

    if (itemError) {
      alert(`운동 세트 저장 오류: ${itemError.message}`)
      return
    }

    alert('운동 기록 저장 완료')

    await syncMemberSessionCount(selectedMemberId)
    await loadMembers()
    await loadWorkoutHistory(selectedMemberId)
    resetWorkoutDraft()
  }

  const editWorkoutRecord = (workout) => {
    const grouped = []
    const map = new Map()

    ;(workout.workout_items || []).forEach((row) => {
      const key = `${row.exercise_name}-${row.body_part}-${row.category}-${row.brand}-${row.good_point || ''}-${row.improve_point || ''}`

      if (!map.has(key)) {
        map.set(key, {
          id: `edit-${Math.random()}`,
          category: row.category,
          bodyPart: row.body_part,
          brand: row.brand,
          exerciseName: row.exercise_name,
          sets: [],
          goodPoint: row.good_point || '',
          improvePoint: row.improve_point || '',
        })
      }

      map.get(key).sets.push({
        setNo: row.set_no,
        kg: row.kg,
        reps: row.reps,
      })
    })

    map.forEach((value) => {
      grouped.push({
        ...value,
        sets: normalizeSetNumbers([...value.sets].sort((a, b) => Number(a.setNo) - Number(b.setNo))),
      })
    })

    setWorkoutDraft({
      date: workout.workout_date,
      bodyParts: workout.body_parts || [],
      items: grouped.length > 0 ? grouped : [createWorkoutItem(getDefaultBrandName(brands))],
    })

    setEditingWorkoutId(workout.id)
    setActiveTab('기록작성')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteWorkoutRecord = async (workoutId) => {
    if (!window.confirm('이 운동 기록을 삭제할까요?')) return

    const { error } = await supabase.from('workouts').delete().eq('id', workoutId)

    if (error) {
      alert(`운동 기록 삭제 오류: ${error.message}`)
      return
    }

    await syncMemberSessionCount(selectedMemberId)
    await loadMembers()
    await loadWorkoutHistory(selectedMemberId)

    if (editingWorkoutId === workoutId) {
      resetWorkoutDraft()
    }
  }

  const updateWorkoutRecord = async () => {
    if (!editingWorkoutId) return

    const deleteOld = await supabase.from('workouts').delete().eq('id', editingWorkoutId)

    if (deleteOld.error) {
      alert(`기존 기록 삭제 오류: ${deleteOld.error.message}`)
      return
    }

    setEditingWorkoutId(null)
    await saveWorkoutRecord()
  }

  const updateRoutineRow = (dayKey, key, value) => {
    setRoutineRows((prev) =>
      prev.map((row) => (row.dayKey === dayKey ? { ...row, [key]: value } : row))
    )
  }

  const saveMemberRoutines = async () => {
    if (!selectedMemberId) {
      alert('회원을 먼저 선택해 주세요.')
      return
    }

    setSavingRoutines(true)

    const insertRows = routineRows
      .map((row, index) => ({
        member_id: selectedMemberId,
        day_key: row.dayKey,
        day_label: row.dayLabel,
        title: row.title.trim(),
        exercises: row.exercisesText
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        sort_order: index + 1,
      }))
      .filter((row) => row.title || row.exercises.length > 0)

    const { error: deleteError } = await supabase
      .from('member_routines')
      .delete()
      .eq('member_id', selectedMemberId)

    if (deleteError) {
      setSavingRoutines(false)
      alert(`기존 루틴 삭제 오류: ${deleteError.message}`)
      return
    }

    if (insertRows.length > 0) {
      const { error: insertError } = await supabase
        .from('member_routines')
        .insert(insertRows)

      if (insertError) {
        setSavingRoutines(false)
        alert(`루틴 저장 오류: ${insertError.message}`)
        return
      }
    }

    setSavingRoutines(false)
    alert('회원 루틴 저장 완료')
    await loadMemberRoutines(selectedMemberId)
  }

  const resetMemberRoutines = () => {
    setRoutineRows(createDefaultRoutineRows())
  }

  const saveManual = async () => {
    setSavingManual(true)

    const { error } = await supabase.from('app_manuals').upsert(
      [
        {
          manual_key: 'common',
          title: manualTitle.trim() || '더피트니스 화정점 사용방법',
          content: manualContent,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'manual_key' }
    )

    if (error) {
      setSavingManual(false)
      alert(`메뉴얼 저장 오류: ${error.message}`)
      return
    }

    setSavingManual(false)
    alert('메뉴얼 저장 완료')
    await loadManual()
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-topbar">
        <div>
          <h2 style={{ margin: 0 }}>관리자 대시보드</h2>
          <div className="muted">
            로그인: {user.email} · {profile.teacher_name || profile.name}
          </div>
        </div>
        <button className="secondary-btn" onClick={onLogout}>
          로그아웃
        </button>
      </div>

      <div className="tab-bar">
        {adminTabs.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === '회원' && (
        <div className="tab-page">
          <div className="admin-grid">
            <section className="card section-card">
              <div className="section-head">
                <div>
                  <div className="section-label">{editMemberId ? '회원 수정' : '회원 추가'}</div>
                  <h2>{editMemberId ? '회원 정보 수정' : '새 회원 등록'}</h2>
                </div>
                {editMemberId && (
                  <button className="secondary-btn" onClick={closeMemberEdit}>
                    수정 취소
                  </button>
                )}
              </div>

              {!editMemberId ? (
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
                      value={memberForm.total_sessions}
                      onChange={(e) => setMemberForm({ ...memberForm, total_sessions: e.target.value })}
                    />
                    <input type="number" placeholder="사용 세션" value={memberForm.used_sessions} disabled />
                  </div>
                  <div className="grid-2">
                    <input
                      type="date"
                      value={memberForm.start_date}
                      onChange={(e) => setMemberForm({ ...memberForm, start_date: e.target.value })}
                    />
                    <input
                      type="date"
                      value={memberForm.end_date}
                      onChange={(e) => setMemberForm({ ...memberForm, end_date: e.target.value })}
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
              ) : (
                <div className="form-block">
                  <input
                    placeholder="회원 이름"
                    value={editMemberForm.name}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, name: e.target.value })}
                  />
                  <input
                    placeholder="목표"
                    value={editMemberForm.goal}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, goal: e.target.value })}
                  />
                  <div className="grid-2">
                    <input
                      type="number"
                      placeholder="총 세션"
                      value={editMemberForm.total_sessions}
                      onChange={(e) => setEditMemberForm({ ...editMemberForm, total_sessions: e.target.value })}
                    />
                    <input
                      type="text"
                      value={
                        selectedMember && selectedMember.id === editMemberId
                          ? `${selectedMember.used_sessions}회 (자동 계산)`
                          : '자동 계산'
                      }
                      disabled
                    />
                  </div>
                  <div className="grid-2">
                    <input
                      type="date"
                      value={editMemberForm.start_date}
                      onChange={(e) => setEditMemberForm({ ...editMemberForm, start_date: e.target.value })}
                    />
                    <input
                      type="date"
                      value={editMemberForm.end_date}
                      onChange={(e) => setEditMemberForm({ ...editMemberForm, end_date: e.target.value })}
                    />
                  </div>
                  <textarea
                    placeholder="메모"
                    value={editMemberForm.memo}
                    onChange={(e) => setEditMemberForm({ ...editMemberForm, memo: e.target.value })}
                  />
                  <button className="primary-btn" onClick={updateMember}>
                    회원 정보 저장
                  </button>
                </div>
              )}
            </section>

            <section className="card section-card">
              <div className="section-head">
                <div>
                  <div className="section-label">회원 목록</div>
                  <h2>등록된 회원</h2>
                </div>
              </div>

              <div className="member-list modern-list">
                {loadingMembers ? (
                  <div className="muted">불러오는 중...</div>
                ) : members.length === 0 ? (
                  <div className="muted">등록된 회원이 없습니다.</div>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className={`member-card ${selectedMemberId === member.id ? 'active' : ''}`}
                      onClick={() => setSelectedMemberId(member.id)}
                    >
                      <div className="member-card-top">
                        <div>
                          <div className="member-card-name">{member.name}</div>
                          <div className="member-card-goal">{member.goal || '목표 미입력'}</div>
                        </div>
                        <div className="member-card-session">
                          {member.used_sessions} / {member.total_sessions}
                        </div>
                      </div>

                      <div className="member-card-sub">
                        남은 세션 {Math.max(member.total_sessions - member.used_sessions, 0)}회
                      </div>

                      <div className="button-row" style={{ marginTop: 12 }}>
                        <button
                          className="secondary-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            openMemberEdit(member)
                          }}
                        >
                          회원 수정
                        </button>
                        <button
                          className="danger-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteMember(member.id)
                          }}
                        >
                          회원 삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {selectedMember && (
            <>
              <section className="card section-card">
                <div className="section-head">
                  <div>
                    <div className="section-label">선택 회원 정보</div>
                    <h2>{selectedMember.name}</h2>
                  </div>
                  <div className="pill">
                    남은 세션 {Math.max(selectedMember.total_sessions - selectedMember.used_sessions, 0)}회
                  </div>
                </div>

                <div className="summary-grid">
                  <div className="summary-box">
                    <div className="summary-label">목표</div>
                    <div className="summary-value">{selectedMember.goal || '미입력'}</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-label">세션</div>
                    <div className="summary-value">
                      {selectedMember.used_sessions} / {selectedMember.total_sessions}회
                    </div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-label">시작일</div>
                    <div className="summary-value">{selectedMember.start_date || '-'}</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-label">종료일</div>
                    <div className="summary-value">{selectedMember.end_date || '-'}</div>
                  </div>
                </div>

                <div className="progress-wrap">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="memo-box">
                  <div className="memo-title">특이사항 / 메모</div>
                  <div>{selectedMember.memo || '메모 없음'}</div>
                </div>

                <div className="member-link-box">
                  <div className="memo-title">회원 링크 / 코드</div>
                  <div className="link-line">링크: {`${window.location.origin}?member=${selectedMember.id}`}</div>
                  <div className="link-line">
                    코드: <strong>{selectedMember.access_code || '-'}</strong>
                  </div>
                  <div className="button-row">
                    <button
                      className="secondary-btn"
                      onClick={() => copyText(`${window.location.origin}?member=${selectedMember.id}`)}
                    >
                      링크 복사
                    </button>
                    <button className="secondary-btn" onClick={() => copyText(selectedMember.access_code || '')}>
                      코드 복사
                    </button>
                  </div>
                </div>
              </section>

              <section className="card section-card">
                <div className="section-head">
                  <div>
                    <div className="section-label">회원 루틴 관리</div>
                    <h2>{selectedMember.name}님 루틴</h2>
                  </div>
                </div>

                {loadingRoutines ? (
                  <div className="muted">루틴 불러오는 중...</div>
                ) : (
                  <div className="routine-admin-list">
                    {routineRows.map((row) => (
                      <div className="routine-admin-card" key={row.dayKey}>
                        <div className="memo-title">{row.dayLabel}</div>
                        <input
                          placeholder="루틴 제목 예: 상체 루틴"
                          value={row.title}
                          onChange={(e) => updateRoutineRow(row.dayKey, 'title', e.target.value)}
                        />
                        <textarea
                          placeholder="운동 목록을 쉼표(,)로 구분해서 입력&#10;예: 벤치프레스, 랫풀다운, 숄더프레스"
                          value={row.exercisesText}
                          onChange={(e) => updateRoutineRow(row.dayKey, 'exercisesText', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="button-row" style={{ marginTop: 16 }}>
                  <button className="primary-btn" onClick={saveMemberRoutines} disabled={savingRoutines}>
                    {savingRoutines ? '루틴 저장 중...' : '회원 루틴 저장'}
                  </button>
                  <button className="secondary-btn" onClick={resetMemberRoutines}>
                    입력 초기화
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {activeTab === '기록작성' && (
        <div className="tab-page">
          {selectedMember && (
            <section className="card section-card">
              <div className="section-head">
                <div>
                  <div className="section-label">대상 회원</div>
                  <h2>{selectedMember.name}</h2>
                </div>
                <div className="pill">
                  남은 세션 {Math.max(selectedMember.total_sessions - selectedMember.used_sessions, 0)}회
                </div>
              </div>

              <div className="summary-grid">
                <div className="summary-box">
                  <div className="summary-label">목표</div>
                  <div className="summary-value">{selectedMember.goal || '미입력'}</div>
                </div>
                <div className="summary-box">
                  <div className="summary-label">진행 세션</div>
                  <div className="summary-value">
                    {selectedMember.used_sessions} / {selectedMember.total_sessions}
                  </div>
                </div>
                <div className="summary-box">
                  <div className="summary-label">이번달 PT</div>
                  <div className="summary-value">{currentMonthPtCount}회</div>
                </div>
                <div className="summary-box">
                  <div className="summary-label">이번달 개인운동</div>
                  <div className="summary-value">{currentMonthSelfCount}회</div>
                </div>
              </div>
            </section>
          )}

          <div className="admin-grid">
            <section className="card section-card">
              <div className="section-head">
                <div>
                  <div className="section-label">{editingWorkoutId ? '기록 수정' : '운동 기록 작성'}</div>
                  <h2>{editingWorkoutId ? '운동 기록 수정하기' : '운동 기록 입력'}</h2>
                </div>
              </div>

              {!selectedMember ? (
                <div className="muted">회원 탭에서 회원을 먼저 선택해 주세요.</div>
              ) : (
                <>
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

                  <div className="section-head" style={{ marginTop: 18 }}>
                    <h3 style={{ margin: 0 }}>운동 목록</h3>
                    <button className="secondary-btn" onClick={addWorkoutItem}>
                      + 운동 추가
                    </button>
                  </div>

                  {workoutDraft.items.map((item, itemIndex) => (
                    <div className="workout-card modern-card" key={item.id}>
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
                          {brandNames.map((o) => (
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
                              onClick={() => applyExercise(itemIndex, exercise)}
                            >
                              {exercise.name} · {exercise.brand_name}
                            </button>
                          ))}
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
                                  onClick={() => removeSet(itemIndex, setIndex)}
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
                                  onChange={(e) => updateSet(itemIndex, setIndex, 'kg', e.target.value)}
                                />
                              </div>
                              <div>
                                <label>횟수(reps)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={setRow.reps}
                                  onChange={(e) => updateSet(itemIndex, setIndex, 'reps', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="button-row" style={{ marginTop: 12 }}>
                        <button type="button" className="secondary-btn" onClick={() => addSet(itemIndex)}>
                          + 세트 추가
                        </button>
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
                    {editingWorkoutId ? (
                      <>
                        <button className="primary-btn" onClick={updateWorkoutRecord}>
                          기록 수정 저장
                        </button>
                        <button className="secondary-btn" onClick={() => resetWorkoutDraft()}>
                          수정 취소
                        </button>
                      </>
                    ) : (
                      <button className="primary-btn" onClick={saveWorkoutRecord}>
                        기록 저장
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="card section-card">
              <div className="section-head">
                <div>
                  <div className="section-label">저장된 운동 기록</div>
                  <h2>간추려보기 / 상세히 보기</h2>
                </div>
              </div>

              {!selectedMember ? (
                <div className="muted">회원 탭에서 회원을 먼저 선택해 주세요.</div>
              ) : workoutHistory.length === 0 ? (
                <div className="muted">저장된 기록이 없습니다.</div>
              ) : (
                <div className="record-list">
                  {workoutHistory.map((workout) => {
                    const groupedItems = groupWorkoutItems(workout.workout_items || [])
                    const isExpanded = expandedWorkoutIds.includes(workout.id)
                    const exerciseCount = groupedItems.length
                    const totalSets = groupedItems.reduce((sum, item) => sum + item.sets.length, 0)

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
                            <button className="secondary-btn" onClick={() => toggleWorkoutDetail(workout.id)}>
                              {isExpanded ? '간추려보기' : '상세히 보기'}
                            </button>
                            <button className="secondary-btn" onClick={() => editWorkoutRecord(workout)}>
                              수정
                            </button>
                            <button className="danger-btn" onClick={() => deleteWorkoutRecord(workout.id)}>
                              삭제
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
                            {groupedItems.map((item) => (
                              <div key={item.id} className="record-detail-card">
                                <div className="record-detail-title">{item.exerciseName}</div>

                                <div className="tag-row" style={{ marginTop: 8 }}>
                                  <span className="tag">{item.bodyPart}</span>
                                  <span className="tag">{item.category}</span>
                                  <span className="tag">{item.brand}</span>
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
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {activeTab === '운동DB' && (
        <div className="tab-page">
          <div className="admin-grid">
            <section className="card section-card">
              <div className="section-head">
                <div>
                  <div className="section-label">브랜드 관리</div>
                  <h2>브랜드 추가 / 수정 / 삭제</h2>
                </div>
              </div>

              {editBrandId && (
                <div className="form-block" style={{ marginBottom: 16 }}>
                  <input
                    placeholder="브랜드 이름"
                    value={editBrandForm.name}
                    onChange={(e) => setEditBrandForm({ name: e.target.value })}
                  />
                  <div className="button-row">
                    <button className="primary-btn" onClick={updateBrand}>
                      브랜드 저장
                    </button>
                    <button className="secondary-btn" onClick={closeBrandEdit}>
                      취소
                    </button>
                  </div>
                </div>
              )}

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

              <div className="list-card-group">
                {loadingBrands ? (
                  <div className="muted">브랜드 불러오는 중...</div>
                ) : (
                  brands.map((brand) => (
                    <div className="list-card-row" key={brand.id}>
                      <div className="list-card-title">{brand.name}</div>
                      <div className="button-row">
                        <button className="secondary-btn" onClick={() => openBrandEdit(brand)}>
                          수정
                        </button>
                        <button className="danger-btn" onClick={() => deleteBrand(brand)}>
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="card section-card">
              <div className="section-head">
                <div>
                  <div className="section-label">운동 DB</div>
                  <h2>운동 추가 / 수정 / 삭제</h2>
                </div>
              </div>

              {editExerciseId && (
                <div className="form-block" style={{ marginBottom: 16 }}>
                  <input
                    placeholder="운동명"
                    value={editExerciseForm.name}
                    onChange={(e) => setEditExerciseForm({ ...editExerciseForm, name: e.target.value })}
                  />

                  <div className="grid-3">
                    <select
                      value={editExerciseForm.bodyPart}
                      onChange={(e) => setEditExerciseForm({ ...editExerciseForm, bodyPart: e.target.value })}
                    >
                      {bodyPartOptions.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <select
                      value={editExerciseForm.category}
                      onChange={(e) => setEditExerciseForm({ ...editExerciseForm, category: e.target.value })}
                    >
                      {categoryOptions.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <select
                      value={editExerciseForm.brand}
                      onChange={(e) => setEditExerciseForm({ ...editExerciseForm, brand: e.target.value })}
                    >
                      {brandNames.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div className="button-row">
                    <button className="primary-btn" onClick={updateExercise}>
                      운동 저장
                    </button>
                    <button className="secondary-btn" onClick={closeExerciseEdit}>
                      취소
                    </button>
                  </div>
                </div>
              )}

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
                    {brandNames.map((o) => (
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

              <div className="list-card-group">
                {loadingExercises ? (
                  <div className="muted">운동DB 불러오는 중...</div>
                ) : (
                  filteredExercises.map((exercise) => (
                    <div className="list-card-row" key={exercise.id}>
                      <div>
                        <div className="list-card-title">{exercise.name}</div>
                        <div className="tag-row" style={{ marginTop: 8 }}>
                          <span className="tag">{exercise.body_part}</span>
                          <span className="tag">{exercise.category}</span>
                          <span className="tag">{exercise.brand_name}</span>
                        </div>
                      </div>

                      <div className="button-row">
                        <button className="secondary-btn" onClick={() => openExerciseEdit(exercise)}>
                          수정
                        </button>
                        <button className="danger-btn" onClick={() => deleteExercise(exercise.id)}>
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === '통계' && (
        <div className="tab-page">
          <section className="card section-card">
            <div className="section-head">
              <div>
                <div className="section-label">이번달 운동 현황</div>
                <h2>{selectedMember ? `${selectedMember.name}님 통계` : '회원 선택 필요'}</h2>
              </div>
            </div>

            {!selectedMember ? (
              <div className="muted">회원 탭에서 회원을 먼저 선택해 주세요.</div>
            ) : (
              <>
                <div className="summary-grid">
                  <div className="summary-box">
                    <div className="summary-label">이번달 총 운동</div>
                    <div className="summary-value">{currentMonthTotal}회</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-label">이번달 PT</div>
                    <div className="summary-value">{currentMonthPtCount}회</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-label">이번달 개인운동</div>
                    <div className="summary-value">{currentMonthSelfCount}회</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-label">남은 세션</div>
                    <div className="summary-value">
                      {Math.max(selectedMember.total_sessions - selectedMember.used_sessions, 0)}회
                    </div>
                  </div>
                </div>

                <div className="memo-box">
                  <div className="memo-title">이번달 요약</div>
                  <div>
                    이번달 총 {currentMonthTotal}번 운동했고, 그중 PT는 {currentMonthPtCount}번,
                    개인운동은 {currentMonthSelfCount}번입니다.
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {activeTab === '사용방법' && (
        <div className="tab-page">
          <section className="card section-card">
            <div className="section-head">
              <div>
                <div className="section-label">사용방법 메뉴얼</div>
                <h2>{manualTitle || '더피트니스 화정점 사용방법'}</h2>
              </div>
              {loadingManual && <div className="muted">불러오는 중...</div>}
            </div>

            <div className="form-block">
              <input
                placeholder="메뉴얼 제목"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
              />
              <textarea
                className="manual-textarea"
                placeholder="관리자와 회원이 같이 볼 사용방법을 입력해 주세요."
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
              />
              <div className="button-row">
                <button className="primary-btn" onClick={saveManual} disabled={savingManual}>
                  {savingManual ? '저장 중...' : '메뉴얼 저장'}
                </button>
                <button className="secondary-btn" onClick={loadManual}>
                  다시 불러오기
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="bottom-tab-bar">
        {adminTabs.map((tab) => (
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
