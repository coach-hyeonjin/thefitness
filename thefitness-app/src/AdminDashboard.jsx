import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import logo from './assets/logo.png'

const TABS = [
  '회원',
  '기록작성',
  '운동DB',
  '식단',
  '통계',
  '코치스케줄',
  '매출기록',
  '프로그램',
  '공지사항',
  '사용방법',
]

const emptyMemberForm = {
  name: '',
  goal: '',
  total_sessions: 20,
  used_sessions: 0,
  start_date: '',
  end_date: '',
  memo: '',
  access_code: '',
  current_program_id: '',
}

const emptyWorkoutItem = {
  exercise_id: '',
  exercise_name_snapshot: '',
  sets: [{ kg: '', reps: '' }],
}

const emptyWorkoutForm = {
  id: null,
  member_id: '',
  workout_date: new Date().toISOString().slice(0, 10),
  workout_type: 'pt',
  good: '',
  improve: '',
  items: [{ ...emptyWorkoutItem }],
}

const emptyBrandForm = { name: '' }

const emptyExerciseForm = {
  name: '',
  body_part: '',
  category: '',
  brand_id: '',
}

const defaultBulkExerciseText = `뉴텍|시티드 디클라인 체스트 프레스|가슴|머신
뉴텍|시티드 체스트 프레스|가슴|머신
뉴텍|펙덱 플라이|가슴|머신`

const timeSlotOptions = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
]

const emptyProgramForm = {
  id: null,
  name: '',
  price: '',
  session_count: '',
  description: '',
  is_vip: false,
  is_active: true,
}

const emptyNoticeForm = {
  id: null,
  title: '',
  content: '',
  category: '공지',
  image_url: '',
  video_url: '',
  is_published: true,
  starts_at: '',
  ends_at: '',
}

const emptySaleForm = {
  id: null,
  member_id: '',
  program_id: '',
  sale_date: new Date().toISOString().slice(0, 10),
  amount: '',
  payment_method: '카드',
  installment_months: 0,
  cash_receipt_issued: false,
  purchased_session_count: 0,
  service_session_count: 0,
  is_vip: false,
  memo: '',
}

function randomCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

function formatDate(value) {
  return value || '-'
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

export default function AdminDashboard({ profile, onLogout }) {
  const [activeTab, setActiveTab] = useState('회원')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [members, setMembers] = useState([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [memberForm, setMemberForm] = useState(emptyMemberForm)
  const [editingMemberId, setEditingMemberId] = useState(null)

  const [memberHealthLogs, setMemberHealthLogs] = useState([])
  const [collapsedHealthLogs, setCollapsedHealthLogs] = useState({})
  const [adminNotes, setAdminNotes] = useState([])
  const [adminNoteInput, setAdminNoteInput] = useState('')

  const [workouts, setWorkouts] = useState([])
  const [workoutItemsMap, setWorkoutItemsMap] = useState({})
  const [collapsedWorkouts, setCollapsedWorkouts] = useState({})
  const [workoutForm, setWorkoutForm] = useState(emptyWorkoutForm)

  const [brands, setBrands] = useState([])
  const [brandForm, setBrandForm] = useState(emptyBrandForm)
  const [editingBrandId, setEditingBrandId] = useState(null)

  const [exercises, setExercises] = useState([])
  const [exerciseForm, setExerciseForm] = useState(emptyExerciseForm)
  const [editingExerciseId, setEditingExerciseId] = useState(null)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [collapsedExercises, setCollapsedExercises] = useState({})
  const [bulkExerciseText, setBulkExerciseText] = useState(defaultBulkExerciseText)
  const [showBulkInput, setShowBulkInput] = useState(false)

  const [dietLogs, setDietLogs] = useState([])
  const [collapsedDiets, setCollapsedDiets] = useState({})
  const [dietMemberFilter, setDietMemberFilter] = useState('')

  const [routineForm, setRoutineForm] = useState({ title: '루틴', content: '' })
  const [manualTarget, setManualTarget] = useState('member')
  const [manualForm, setManualForm] = useState({ title: '', content: '' })
  const [manuals, setManuals] = useState([])

  const [coaches, setCoaches] = useState([])
  const [selectedCoachId, setSelectedCoachId] = useState('')
  const [scheduleMonth, setScheduleMonth] = useState(new Date().toISOString().slice(0, 7))
  const [scheduleForm, setScheduleForm] = useState({
    schedule_date: new Date().toISOString().slice(0, 10),
    is_working: true,
    is_weekend_work: false,
    work_start: '09:00',
    work_end: '18:00',
    memo: '',
    selectedSlots: ['10:00', '11:00', '14:00', '15:00'],
  })
  const [coachSchedules, setCoachSchedules] = useState([])
  const [coachScheduleSlotsMap, setCoachScheduleSlotsMap] = useState({})
  const [collapsedSchedules, setCollapsedSchedules] = useState({})

  const [programs, setPrograms] = useState([])
  const [programForm, setProgramForm] = useState(emptyProgramForm)
  const [editingProgramId, setEditingProgramId] = useState(null)

  const [salesRecords, setSalesRecords] = useState([])
  const [saleForm, setSaleForm] = useState(emptySaleForm)
  const [editingSaleId, setEditingSaleId] = useState(null)
  const [saleMonth, setSaleMonth] = useState(new Date().toISOString().slice(0, 7))
  const [salesSummary, setSalesSummary] = useState(null)

  const [notices, setNotices] = useState([])
  const [noticeForm, setNoticeForm] = useState(emptyNoticeForm)
  const [editingNoticeId, setEditingNoticeId] = useState(null)
  const [collapsedNotices, setCollapsedNotices] = useState({})

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) || null,
    [members, selectedMemberId],
  )

  const selectedCoach = useMemo(
    () => coaches.find((coach) => coach.id === selectedCoachId) || null,
    [coaches, selectedCoachId],
  )

  const filteredExercises = useMemo(() => {
    const keyword = exerciseSearch.trim().toLowerCase()
    if (!keyword) return exercises
    return exercises.filter((exercise) => {
      const brandName = exercise.brands?.name || ''
      return (
        exercise.name.toLowerCase().includes(keyword) ||
        (exercise.body_part || '').toLowerCase().includes(keyword) ||
        (exercise.category || '').toLowerCase().includes(keyword) ||
        brandName.toLowerCase().includes(keyword)
      )
    })
  }, [exerciseSearch, exercises])

  const memberStats = useMemo(() => {
    return members.map((member) => {
      const memberWorkouts = workouts.filter((workout) => workout.member_id === member.id)
      const ptCount = memberWorkouts.filter((workout) => workout.workout_type === 'pt').length
      const personalCount = memberWorkouts.filter((workout) => workout.workout_type === 'personal').length
      const remainingSessions = Math.max(
        Number(member.total_sessions || 0) - Number(member.used_sessions || 0),
        0,
      )
      return {
        ...member,
        ptCount,
        personalCount,
        remainingSessions,
      }
    })
  }, [members, workouts])

  const monthlyStats = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7)
    const monthWorkouts = workouts.filter((workout) =>
      (workout.workout_date || '').startsWith(monthKey),
    )
    return {
      ptCount: monthWorkouts.filter((workout) => workout.workout_type === 'pt').length,
      personalCount: monthWorkouts.filter((workout) => workout.workout_type === 'personal').length,
      remainingSessions: members.reduce(
        (sum, member) =>
          sum + Math.max(Number(member.total_sessions || 0) - Number(member.used_sessions || 0), 0),
        0,
      ),
    }
  }, [workouts, members])

  const filteredSchedules = useMemo(() => {
    return coachSchedules.filter((schedule) => getMonthKey(schedule.schedule_date) === scheduleMonth)
  }, [coachSchedules, scheduleMonth])

  const filteredSales = useMemo(() => {
    return salesRecords.filter((sale) => getMonthKey(sale.sale_date) === saleMonth)
  }, [salesRecords, saleMonth])

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    const found = manuals.find((manual) => manual.target_role === manualTarget)
    if (found) {
      setManualForm({
        title: found.title || '',
        content: found.content || '',
      })
    } else {
      setManualForm({ title: '', content: '' })
    }
  }, [manualTarget, manuals])

  useEffect(() => {
    if (!selectedMemberId) {
      setRoutineForm({ title: '루틴', content: '' })
      setAdminNotes([])
      setMemberHealthLogs([])
      setAdminNoteInput('')
      return
    }
    loadRoutine(selectedMemberId)
    loadAdminNotes(selectedMemberId)
    loadHealthLogs(selectedMemberId)
  }, [selectedMemberId])

  useEffect(() => {
    loadSalesSummary(saleMonth)
  }, [saleMonth])

  const loadAll = async () => {
    setLoading(true)
    setMessage('')

    await Promise.all([
      loadMembers(),
      loadBrands(),
      loadExercises(),
      loadWorkouts(),
      loadDietLogs(),
      loadManuals(),
      loadCoaches(),
      loadCoachSchedules(),
      loadPrograms(),
      loadSalesRecords(),
      loadNotices(),
    ])

    setLoading(false)
  }

  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('*, programs(id, name)')
      .order('created_at', { ascending: false })

    if (data) {
      setMembers(data)
      if (!selectedMemberId && data[0]) setSelectedMemberId(data[0].id)
    }
  }

  const loadHealthLogs = async (memberId) => {
    const { data } = await supabase
      .from('member_health_logs')
      .select('*')
      .eq('member_id', memberId)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })

    const collapsed = {}
    ;(data || []).forEach((item) => {
      collapsed[item.id] = true
    })
    setMemberHealthLogs(data || [])
    setCollapsedHealthLogs(collapsed)
  }

  const loadAdminNotes = async (memberId) => {
    const { data } = await supabase
      .from('member_admin_notes')
      .select('*')
      .eq('member_id', memberId)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })

    setAdminNotes(data || [])
  }

  const loadBrands = async () => {
    const { data } = await supabase.from('brands').select('*').order('name', { ascending: true })
    if (data) setBrands(data)
  }

  const loadExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*, brands(id, name)')
      .order('created_at', { ascending: false })

    if (data) {
      const collapsed = {}
      data.forEach((exercise) => {
        collapsed[exercise.id] = true
      })
      setExercises(data)
      setCollapsedExercises(collapsed)
    }
  }

  const loadWorkouts = async () => {
    const { data: workoutData } = await supabase
      .from('workouts')
      .select('*')
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

  const loadRoutine = async (memberId) => {
    const { data } = await supabase
      .from('member_routines')
      .select('*')
      .eq('member_id', memberId)
      .maybeSingle()

    if (data) {
      setRoutineForm({
        title: data.title || '루틴',
        content: data.content || '',
      })
    } else {
      setRoutineForm({ title: '루틴', content: '' })
    }
  }

  const loadManuals = async () => {
    const { data } = await supabase.from('app_manuals').select('*').order('target_role')
    if (data) setManuals(data)
  }

  const loadCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('*')
      .order('created_at', { ascending: true })

    if (data) {
      setCoaches(data)
      if (!selectedCoachId && data[0]) setSelectedCoachId(data[0].id)
    }
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

  const loadPrograms = async () => {
    const { data } = await supabase
      .from('programs')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setPrograms(data)
  }

  const loadSalesRecords = async () => {
    const { data } = await supabase
      .from('sales_records')
      .select('*, members(id, name), programs(id, name)')
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (data) setSalesRecords(data)
  }

  const loadSalesSummary = async (month) => {
    const { data } = await supabase.rpc('get_sales_summary', { target_month: month })
    if (data && data[0]) {
      setSalesSummary(data[0])
    } else {
      setSalesSummary(null)
    }
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

  const resetMemberForm = () => {
    setMemberForm(emptyMemberForm)
    setEditingMemberId(null)
  }

  const handleMemberSubmit = async (e) => {
    e.preventDefault()
    setMessage('')

    const payload = {
      name: memberForm.name?.trim() || '',
      goal: memberForm.goal?.trim() || '',
      total_sessions: Number(memberForm.total_sessions) || 0,
      used_sessions: Number(memberForm.used_sessions) || 0,
      start_date: memberForm.start_date || null,
      end_date: memberForm.end_date || null,
      memo: memberForm.memo?.trim() || '',
      access_code: (memberForm.access_code || randomCode()).trim().toUpperCase(),
      current_program_id: memberForm.current_program_id || null,
    }

    if (!payload.name) {
      setMessage('회원 이름을 입력해주세요.')
      return
    }

    if (editingMemberId) {
      const { error } = await supabase.from('members').update(payload).eq('id', editingMemberId)
      if (error) {
        setMessage(error.message)
        return
      }
      setMessage('회원 정보가 수정되었습니다.')
    } else {
      const { error } = await supabase.from('members').insert(payload)
      if (error) {
        setMessage(error.message)
        return
      }
      setMessage('회원이 추가되었습니다.')
    }

    resetMemberForm()
    await loadMembers()
  }

  const handleMemberEdit = (member) => {
    setEditingMemberId(member.id)
    setSelectedMemberId(member.id)
    setMemberForm({
      name: member.name || '',
      goal: member.goal || '',
      total_sessions: member.total_sessions || 0,
      used_sessions: member.used_sessions || 0,
      start_date: member.start_date || '',
      end_date: member.end_date || '',
      memo: member.memo || '',
      access_code: member.access_code || '',
      current_program_id: member.current_program_id || '',
    })
  }

  const handleMemberDelete = async (memberId) => {
    if (!window.confirm('회원을 삭제할까요?')) return
    await supabase.from('members').delete().eq('id', memberId)
    if (selectedMemberId === memberId) {
      setSelectedMemberId('')
      resetMemberForm()
      setRoutineForm({ title: '루틴', content: '' })
      setAdminNotes([])
      setMemberHealthLogs([])
    }
    await loadAll()
    setMessage('회원이 삭제되었습니다.')
  }

  const copyMemberLink = async (member) => {
    const text = `${window.location.origin}?member=${member.id}\nAccess Code: ${member.access_code}`
    try {
      await navigator.clipboard.writeText(text)
      setMessage('회원 링크와 access code가 복사되었습니다.')
    } catch {
      setMessage('복사에 실패했습니다.')
    }
  }

  const handleAdminNoteSave = async () => {
    if (!selectedMemberId || !adminNoteInput.trim()) {
      setMessage('회원과 메모 내용을 확인해주세요.')
      return
    }

    const { error } = await supabase.from('member_admin_notes').insert({
      member_id: selectedMemberId,
      admin_id: profile?.id || null,
      note: adminNoteInput.trim(),
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setAdminNoteInput('')
    await loadAdminNotes(selectedMemberId)
    setMessage('관리자 메모가 저장되었습니다.')
  }

  const handleAdminNoteDelete = async (noteId) => {
    if (!window.confirm('이 메모를 삭제할까요?')) return
    await supabase.from('member_admin_notes').delete().eq('id', noteId)
    await loadAdminNotes(selectedMemberId)
    setMessage('관리자 메모가 삭제되었습니다.')
  }

  const handleRoutineSave = async () => {
    if (!selectedMemberId) {
      setMessage('루틴을 저장할 회원을 먼저 선택해주세요.')
      return
    }

    const payload = {
      member_id: selectedMemberId,
      title: routineForm.title?.trim() || '루틴',
      content: routineForm.content?.trim() || '',
    }

    const { data: existing } = await supabase
      .from('member_routines')
      .select('id')
      .eq('member_id', selectedMemberId)
      .maybeSingle()

    if (existing?.id) {
      await supabase.from('member_routines').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('member_routines').insert(payload)
    }

    setMessage('루틴이 저장되었습니다.')
    await loadRoutine(selectedMemberId)
  }

  const handleRoutineDelete = async () => {
    if (!selectedMemberId) {
      setMessage('삭제할 회원을 먼저 선택해주세요.')
      return
    }
    if (!window.confirm('이 회원의 루틴을 삭제할까요?')) return

    await supabase.from('member_routines').delete().eq('member_id', selectedMemberId)
    setRoutineForm({ title: '루틴', content: '' })
    setMessage('루틴이 삭제되었습니다.')
  }

  const resetWorkoutForm = () => {
    setWorkoutForm(emptyWorkoutForm)
  }

  const updateWorkoutItemSelect = (itemIndex, exerciseId) => {
    const found = exercises.find((exercise) => String(exercise.id) === String(exerciseId))
    setWorkoutForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        exercise_id: found?.id || '',
        exercise_name_snapshot: found?.name || nextItems[itemIndex].exercise_name_snapshot,
      }
      return { ...prev, items: nextItems }
    })
  }

  const updateWorkoutItemName = (itemIndex, value) => {
    setWorkoutForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        exercise_name_snapshot: value,
      }
      return { ...prev, items: nextItems }
    })
  }

  const addWorkoutItem = () => {
    setWorkoutForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyWorkoutItem }],
    }))
  }

  const removeWorkoutItem = (itemIndex) => {
    setWorkoutForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== itemIndex),
    }))
  }

  const addSet = (itemIndex) => {
    setWorkoutForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        sets: [...nextItems[itemIndex].sets, { kg: '', reps: '' }],
      }
      return { ...prev, items: nextItems }
    })
  }

  const removeSet = (itemIndex, setIndex) => {
    setWorkoutForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        sets: nextItems[itemIndex].sets.filter((_, idx) => idx !== setIndex),
      }
      return { ...prev, items: nextItems }
    })
  }

  const updateSetValue = (itemIndex, setIndex, field, value) => {
    setWorkoutForm((prev) => {
      const nextItems = [...prev.items]
      const nextSets = [...nextItems[itemIndex].sets]
      nextSets[setIndex] = { ...nextSets[setIndex], [field]: value }
      nextItems[itemIndex] = { ...nextItems[itemIndex], sets: nextSets }
      return { ...prev, items: nextItems }
    })
  }

  const handleWorkoutSubmit = async (e) => {
    e.preventDefault()

    if (!workoutForm.member_id) {
      setMessage('회원을 선택해주세요.')
      return
    }

    const cleanedItems = workoutForm.items
      .filter((item) => item.exercise_name_snapshot?.trim())
      .map((item, index) => ({
        workout_id: workoutForm.id || null,
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
      member_id: workoutForm.member_id,
      workout_date: workoutForm.workout_date,
      workout_type: workoutForm.workout_type,
      good: workoutForm.good?.trim() || '',
      improve: workoutForm.improve?.trim() || '',
      created_by: profile?.id || null,
    }

    let targetWorkoutId = workoutForm.id

    if (workoutForm.id) {
      const { error } = await supabase.from('workouts').update(payload).eq('id', workoutForm.id)
      if (error) {
        setMessage(error.message)
        return
      }
      await supabase.from('workout_items').delete().eq('workout_id', workoutForm.id)
    } else {
      const { data, error } = await supabase.from('workouts').insert(payload).select().single()
      if (error || !data) {
        setMessage(error?.message || '운동 기록 저장에 실패했습니다.')
        return
      }
      targetWorkoutId = data.id
    }

    await supabase.from('workout_items').insert(
      cleanedItems.map((item) => ({
        ...item,
        workout_id: targetWorkoutId,
      })),
    )

    await loadWorkouts()

    if (workoutForm.workout_type === 'pt') {
      const { data: freshWorkouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('member_id', workoutForm.member_id)

      const freshPtCount = (freshWorkouts || []).filter((workout) => workout.workout_type === 'pt').length

      await supabase
        .from('members')
        .update({ used_sessions: freshPtCount })
        .eq('id', workoutForm.member_id)

      await loadMembers()
    }

    setMessage(workoutForm.id ? '운동 기록이 수정되었습니다.' : '운동 기록이 저장되었습니다.')
    resetWorkoutForm()
  }

  const handleWorkoutEdit = (workout) => {
    const items = workoutItemsMap[workout.id] || []
    setWorkoutForm({
      id: workout.id,
      member_id: workout.member_id,
      workout_date: workout.workout_date,
      workout_type: workout.workout_type,
      good: workout.good || '',
      improve: workout.improve || '',
      items:
        items.length > 0
          ? items.map((item) => ({
              exercise_id: item.exercise_id || '',
              exercise_name_snapshot: item.exercise_name_snapshot || '',
              sets: Array.isArray(item.sets) && item.sets.length > 0 ? item.sets : [{ kg: '', reps: '' }],
            }))
          : [{ ...emptyWorkoutItem }],
    })
    setActiveTab('기록작성')
  }

  const handleWorkoutDelete = async (workout) => {
    if (!window.confirm('이 운동 기록을 삭제할까요?')) return

    await supabase.from('workouts').delete().eq('id', workout.id)
    await loadWorkouts()

    if (workout.workout_type === 'pt') {
      const { data: freshWorkouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('member_id', workout.member_id)

      const freshPtCount = (freshWorkouts || []).filter((item) => item.workout_type === 'pt').length

      await supabase.from('members').update({ used_sessions: freshPtCount }).eq('id', workout.member_id)
      await loadMembers()
    }

    setMessage('운동 기록이 삭제되었습니다.')
  }

  const handleBrandSubmit = async (e) => {
    e.preventDefault()
    if (!brandForm.name.trim()) return

    if (editingBrandId) {
      await supabase.from('brands').update({ name: brandForm.name.trim() }).eq('id', editingBrandId)
      setMessage('브랜드가 수정되었습니다.')
    } else {
      await supabase.from('brands').insert({ name: brandForm.name.trim() })
      setMessage('브랜드가 추가되었습니다.')
    }

    setBrandForm(emptyBrandForm)
    setEditingBrandId(null)
    await loadBrands()
  }

  const handleBrandDelete = async (brandId) => {
    if (!window.confirm('브랜드를 삭제할까요?')) return
    await supabase.from('brands').delete().eq('id', brandId)
    await loadBrands()
    await loadExercises()
    setMessage('브랜드가 삭제되었습니다.')
  }

  const handleExerciseSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      name: exerciseForm.name?.trim() || '',
      body_part: exerciseForm.body_part?.trim() || '',
      category: exerciseForm.category?.trim() || '',
      brand_id: exerciseForm.brand_id || null,
    }

    if (!payload.name) {
      setMessage('운동명을 입력해주세요.')
      return
    }

    if (editingExerciseId) {
      await supabase.from('exercises').update(payload).eq('id', editingExerciseId)
      setMessage('운동이 수정되었습니다.')
    } else {
      await supabase.from('exercises').insert(payload)
      setMessage('운동이 추가되었습니다.')
    }

    setExerciseForm(emptyExerciseForm)
    setEditingExerciseId(null)
    await loadExercises()
  }

  const handleExerciseDelete = async (exerciseId) => {
    if (!window.confirm('운동을 삭제할까요?')) return
    await supabase.from('exercises').delete().eq('id', exerciseId)
    await loadExercises()
    setMessage('운동이 삭제되었습니다.')
  }

  const handleBulkExerciseInsert = async () => {
    const lines = bulkExerciseText.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length === 0) {
      setMessage('일괄 입력할 내용을 넣어주세요.')
      return
    }

    const brandMap = new Map(brands.map((brand) => [brand.name, brand.id]))
    const rowsToInsert = []

    for (const line of lines) {
      const [brandNameRaw, nameRaw, bodyPartRaw, categoryRaw] = line.split('|')
      const brandName = (brandNameRaw || '').trim()
      const name = (nameRaw || '').trim()
      const body_part = (bodyPartRaw || '').trim()
      const category = (categoryRaw || '').trim()
      if (!name) continue

      let brandId = null

      if (brandName) {
        if (!brandMap.has(brandName)) {
          const { data: newBrand, error } = await supabase
            .from('brands')
            .insert({ name: brandName })
            .select()
            .single()

          if (!error && newBrand) {
            brandMap.set(brandName, newBrand.id)
          }
        }
        brandId = brandMap.get(brandName) || null
      }

      rowsToInsert.push({
        name,
        body_part,
        category,
        brand_id: brandId,
      })
    }

    if (rowsToInsert.length === 0) {
      setMessage('입력 가능한 운동 데이터가 없습니다.')
      return
    }

    const { error } = await supabase.from('exercises').insert(rowsToInsert)
    if (error) {
      setMessage(error.message)
      return
    }

    await loadBrands()
    await loadExercises()
    setMessage(`${rowsToInsert.length}개의 운동이 일괄 등록되었습니다.`)
  }

  const handleDietFeedbackSave = async (dietId, payload) => {
    await supabase.from('diet_logs').update(payload).eq('id', dietId)
    await loadDietLogs()
    setMessage('식단 피드백이 저장되었습니다.')
  }

  const handleDietDelete = async (dietId) => {
    if (!window.confirm('식단 기록을 삭제할까요?')) return
    await supabase.from('diet_logs').delete().eq('id', dietId)
    await loadDietLogs()
    setMessage('식단 기록이 삭제되었습니다.')
  }

  const handleManualSave = async () => {
    const payload = {
      target_role: manualTarget,
      title: manualForm.title?.trim() || '',
      content: manualForm.content?.trim() || '',
    }

    const existing = manuals.find((manual) => manual.target_role === manualTarget)

    if (existing?.id) {
      await supabase.from('app_manuals').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('app_manuals').insert(payload)
    }

    await loadManuals()
    setMessage('사용방법이 저장되었습니다.')
  }

  const handleManualDelete = async () => {
    const existing = manuals.find((manual) => manual.target_role === manualTarget)
    if (!existing?.id) return
    if (!window.confirm('이 사용방법을 삭제할까요?')) return

    await supabase.from('app_manuals').delete().eq('id', existing.id)
    await loadManuals()
    setManualForm({ title: '', content: '' })
    setMessage('사용방법이 삭제되었습니다.')
  }

  const resetScheduleForm = () => {
    setScheduleForm({
      schedule_date: new Date().toISOString().slice(0, 10),
      is_working: true,
      is_weekend_work: false,
      work_start: '09:00',
      work_end: '18:00',
      memo: '',
      selectedSlots: ['10:00', '11:00', '14:00', '15:00'],
    })
  }

  const toggleScheduleSlot = (time) => {
    setScheduleForm((prev) => {
      const exists = prev.selectedSlots.includes(time)
      return {
        ...prev,
        selectedSlots: exists
          ? prev.selectedSlots.filter((slot) => slot !== time)
          : [...prev.selectedSlots, time].sort(),
      }
    })
  }

  const handleScheduleSave = async () => {
    if (!selectedCoachId) {
      setMessage('코치를 먼저 선택해주세요.')
      return
    }

    if (!scheduleForm.schedule_date) {
      setMessage('날짜를 선택해주세요.')
      return
    }

    const payload = {
      coach_id: selectedCoachId,
      schedule_date: scheduleForm.schedule_date,
      is_working: scheduleForm.is_working,
      is_weekend_work: scheduleForm.is_weekend_work,
      work_start: scheduleForm.is_working ? scheduleForm.work_start || null : null,
      work_end: scheduleForm.is_working ? scheduleForm.work_end || null : null,
      memo: scheduleForm.memo?.trim() || '',
    }

    const { data: existing } = await supabase
      .from('coach_schedules')
      .select('id')
      .eq('coach_id', selectedCoachId)
      .eq('schedule_date', scheduleForm.schedule_date)
      .maybeSingle()

    let scheduleId = existing?.id || null

    if (scheduleId) {
      await supabase.from('coach_schedules').update(payload).eq('id', scheduleId)
      await supabase.from('coach_schedule_slots').delete().eq('schedule_id', scheduleId)
    } else {
      const { data } = await supabase.from('coach_schedules').insert(payload).select().single()
      scheduleId = data.id
    }

    if (scheduleForm.is_working && scheduleForm.selectedSlots.length > 0) {
      await supabase.from('coach_schedule_slots').insert(
        scheduleForm.selectedSlots.map((slot) => ({
          schedule_id: scheduleId,
          slot_time: slot,
          is_available: true,
          note: '',
        })),
      )
    }

    await loadCoachSchedules()
    setMessage('코치 스케줄이 저장되었습니다.')
    resetScheduleForm()
  }

  const handleScheduleEdit = (schedule) => {
    const slots = coachScheduleSlotsMap[schedule.id] || []
    setSelectedCoachId(schedule.coach_id)
    setScheduleForm({
      schedule_date: schedule.schedule_date,
      is_working: schedule.is_working,
      is_weekend_work: schedule.is_weekend_work,
      work_start: schedule.work_start || '09:00',
      work_end: schedule.work_end || '18:00',
      memo: schedule.memo || '',
      selectedSlots: slots.filter((slot) => slot.is_available).map((slot) => slot.slot_time),
    })
    setActiveTab('코치스케줄')
  }

  const handleScheduleDelete = async (scheduleId) => {
    if (!window.confirm('이 스케줄을 삭제할까요?')) return
    await supabase.from('coach_schedules').delete().eq('id', scheduleId)
    await loadCoachSchedules()
    setMessage('코치 스케줄이 삭제되었습니다.')
  }

  const resetProgramForm = () => {
    setProgramForm(emptyProgramForm)
    setEditingProgramId(null)
  }

  const handleProgramSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      name: programForm.name?.trim() || '',
      price: Number(programForm.price) || 0,
      session_count: Number(programForm.session_count) || 0,
      description: programForm.description?.trim() || '',
      is_vip: !!programForm.is_vip,
      is_active: !!programForm.is_active,
    }

    if (!payload.name) {
      setMessage('프로그램명을 입력해주세요.')
      return
    }

    if (editingProgramId) {
      await supabase.from('programs').update(payload).eq('id', editingProgramId)
      setMessage('프로그램이 수정되었습니다.')
    } else {
      await supabase.from('programs').insert(payload)
      setMessage('프로그램이 추가되었습니다.')
    }

    resetProgramForm()
    await loadPrograms()
    await loadMembers()
  }

  const handleProgramEdit = (program) => {
    setEditingProgramId(program.id)
    setProgramForm({
      id: program.id,
      name: program.name || '',
      price: program.price || '',
      session_count: program.session_count || '',
      description: program.description || '',
      is_vip: !!program.is_vip,
      is_active: !!program.is_active,
    })
  }

  const handleProgramDelete = async (programId) => {
    if (!window.confirm('프로그램을 삭제할까요?')) return
    await supabase.from('programs').delete().eq('id', programId)
    await loadPrograms()
    setMessage('프로그램이 삭제되었습니다.')
  }

  const resetSaleForm = () => {
    setSaleForm(emptySaleForm)
    setEditingSaleId(null)
  }

  const handleSaleSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      member_id: saleForm.member_id || null,
      program_id: saleForm.program_id || null,
      sale_date: saleForm.sale_date,
      amount: Number(saleForm.amount) || 0,
      payment_method: saleForm.payment_method,
      installment_months: Number(saleForm.installment_months) || 0,
      cash_receipt_issued: !!saleForm.cash_receipt_issued,
      purchased_session_count: Number(saleForm.purchased_session_count) || 0,
      service_session_count: Number(saleForm.service_session_count) || 0,
      is_vip: !!saleForm.is_vip,
      memo: saleForm.memo?.trim() || '',
    }

    if (editingSaleId) {
      await supabase.from('sales_records').update(payload).eq('id', editingSaleId)
      setMessage('매출 기록이 수정되었습니다.')
    } else {
      await supabase.from('sales_records').insert(payload)
      setMessage('매출 기록이 저장되었습니다.')
    }

    resetSaleForm()
    await loadSalesRecords()
    await loadSalesSummary(saleMonth)
  }

  const handleSaleEdit = (sale) => {
    setEditingSaleId(sale.id)
    setSaleForm({
      id: sale.id,
      member_id: sale.member_id || '',
      program_id: sale.program_id || '',
      sale_date: sale.sale_date,
      amount: sale.amount || '',
      payment_method: sale.payment_method || '카드',
      installment_months: sale.installment_months || 0,
      cash_receipt_issued: !!sale.cash_receipt_issued,
      purchased_session_count: sale.purchased_session_count || 0,
      service_session_count: sale.service_session_count || 0,
      is_vip: !!sale.is_vip,
      memo: sale.memo || '',
    })
  }

  const handleSaleDelete = async (saleId) => {
    if (!window.confirm('매출 기록을 삭제할까요?')) return
    await supabase.from('sales_records').delete().eq('id', saleId)
    await loadSalesRecords()
    await loadSalesSummary(saleMonth)
    setMessage('매출 기록이 삭제되었습니다.')
  }

  const getSalesAutoFeedback = () => {
    if (!salesSummary) return '매출 데이터가 없습니다.'
    const total = Number(salesSummary.total_sales || 0)
    const count = Number(salesSummary.total_count || 0)
    const vip = Number(salesSummary.vip_sales_count || 0)

    if (count === 0) return '이번 달 등록된 매출 기록이 없습니다.'
    if (total >= 3000000) return '좋습니다. 이번 달 매출 흐름이 안정적입니다.'
    if (vip >= 3) return 'VIP 전환이 잘 이루어지고 있습니다.'
    if (total < 1000000) return '이번 달은 신규 등록/재등록 전환 전략 점검이 필요합니다.'
    return '현재 매출 흐름은 보통 수준입니다. 결제수단과 프로그램 전환율을 함께 보세요.'
  }

  const resetNoticeForm = () => {
    setNoticeForm(emptyNoticeForm)
    setEditingNoticeId(null)
  }

  const handleNoticeSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      title: noticeForm.title?.trim() || '',
      content: noticeForm.content?.trim() || '',
      category: noticeForm.category,
      image_url: noticeForm.image_url?.trim() || '',
      video_url: noticeForm.video_url?.trim() || '',
      is_published: !!noticeForm.is_published,
      starts_at: noticeForm.starts_at || null,
      ends_at: noticeForm.ends_at || null,
      created_by: profile?.id || null,
    }

    if (!payload.title) {
      setMessage('공지 제목을 입력해주세요.')
      return
    }

    if (editingNoticeId) {
      await supabase.from('notices').update(payload).eq('id', editingNoticeId)
      setMessage('공지사항이 수정되었습니다.')
    } else {
      await supabase.from('notices').insert(payload)
      setMessage('공지사항이 등록되었습니다.')
    }

    resetNoticeForm()
    await loadNotices()
  }

  const handleNoticeEdit = (notice) => {
    setEditingNoticeId(notice.id)
    setNoticeForm({
      id: notice.id,
      title: notice.title || '',
      content: notice.content || '',
      category: notice.category || '공지',
      image_url: notice.image_url || '',
      video_url: notice.video_url || '',
      is_published: !!notice.is_published,
      starts_at: notice.starts_at || '',
      ends_at: notice.ends_at || '',
    })
  }

  const handleNoticeDelete = async (noticeId) => {
    if (!window.confirm('공지사항을 삭제할까요?')) return
    await supabase.from('notices').delete().eq('id', noticeId)
    await loadNotices()
    setMessage('공지사항이 삭제되었습니다.')
  }

  const displayedDietLogs = dietMemberFilter
    ? dietLogs.filter((diet) => diet.member_id === dietMemberFilter)
    : dietLogs

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
            <h1 className="page-title">관리자 시스템</h1>
            <p className="sub-text">{profile?.name || '관리자'}님 접속 중</p>
          </div>
        </div>
        <button className="secondary-btn" onClick={onLogout}>
          로그아웃
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

      {activeTab === '회원' && (
        <div className="two-col">
          <section className="card">
            <h2>회원 등록 / 수정</h2>
            <form className="stack-gap" onSubmit={handleMemberSubmit}>
              <label className="field">
                <span>이름</span>
                <input value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} />
              </label>

              <label className="field">
                <span>목표</span>
                <input value={memberForm.goal} onChange={(e) => setMemberForm({ ...memberForm, goal: e.target.value })} />
              </label>

              <label className="field">
                <span>현재 프로그램</span>
                <select
                  value={memberForm.current_program_id}
                  onChange={(e) => setMemberForm({ ...memberForm, current_program_id: e.target.value })}
                >
                  <option value="">선택 안함</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid-2">
                <label className="field">
                  <span>총 세션</span>
                  <input
                    type="number"
                    value={memberForm.total_sessions}
                    onChange={(e) => setMemberForm({ ...memberForm, total_sessions: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>사용 세션</span>
                  <input
                    type="number"
                    value={memberForm.used_sessions}
                    onChange={(e) => setMemberForm({ ...memberForm, used_sessions: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid-2">
                <label className="field">
                  <span>시작일</span>
                  <input
                    type="date"
                    value={memberForm.start_date}
                    onChange={(e) => setMemberForm({ ...memberForm, start_date: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>종료일</span>
                  <input
                    type="date"
                    value={memberForm.end_date}
                    onChange={(e) => setMemberForm({ ...memberForm, end_date: e.target.value })}
                  />
                </label>
              </div>

              <label className="field">
                <span>회원 메모(회원에게 보임)</span>
                <textarea rows="4" value={memberForm.memo} onChange={(e) => setMemberForm({ ...memberForm, memo: e.target.value })} />
              </label>

              <label className="field">
                <span>Access Code</span>
                <div className="inline-actions">
                  <input
                    value={memberForm.access_code}
                    onChange={(e) => setMemberForm({ ...memberForm, access_code: e.target.value.toUpperCase() })}
                  />
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setMemberForm((prev) => ({ ...prev, access_code: randomCode() }))}
                  >
                    생성
                  </button>
                </div>
              </label>

              <div className="inline-actions wrap">
                <button className="primary-btn" type="submit">
                  {editingMemberId ? '회원 수정' : '회원 추가'}
                </button>
                <button type="button" className="secondary-btn" onClick={resetMemberForm}>
                  초기화
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>회원 목록</h2>
            <div className="list-stack">
              {memberStats.map((member) => {
                const isSelected = selectedMemberId === member.id
                return (
                  <div
                    key={member.id}
                    className={`list-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedMemberId(member.id)}
                  >
                    <div className="list-card-top">
                      <strong>{member.name}</strong>
                      <span className="pill">남은 {member.remainingSessions}회</span>
                    </div>

                    <div className="compact-text">
                      목표: {member.goal || '-'} / Access: {member.access_code}
                    </div>
                    <div className="compact-text">
                      PT {member.ptCount}회 / 개인운동 {member.personalCount}회 / 프로그램 {member.programs?.name || '-'}
                    </div>

                    <div className="inline-actions wrap">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMemberEdit(member)
                        }}
                      >
                        수정
                      </button>

                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyMemberLink(member)
                        }}
                      >
                        링크 복사
                      </button>

                      <button
                        type="button"
                        className="danger-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMemberDelete(member.id)
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {selectedMember ? (
              <>
                <div className="sub-card">
                  <h3>선택 회원 상세 / 루틴 관리</h3>
                  <div className="detail-box">
                    <p><strong>이름:</strong> {selectedMember.name}</p>
                    <p><strong>목표:</strong> {selectedMember.goal || '-'}</p>
                    <p><strong>프로그램:</strong> {selectedMember.programs?.name || '-'}</p>
                    <p><strong>기간:</strong> {formatDate(selectedMember.start_date)} ~ {formatDate(selectedMember.end_date)}</p>
                    <p><strong>회원 메모:</strong> {selectedMember.memo || '-'}</p>
                    <p><strong>회원 링크:</strong> {window.location.origin}?member={selectedMember.id}</p>
                  </div>

                  <div className="stack-gap">
                    <label className="field">
                      <span>루틴 제목</span>
                      <input value={routineForm.title} onChange={(e) => setRoutineForm({ ...routineForm, title: e.target.value })} />
                    </label>

                    <label className="field">
                      <span>루틴 내용</span>
                      <textarea rows="6" value={routineForm.content} onChange={(e) => setRoutineForm({ ...routineForm, content: e.target.value })} />
                    </label>

                    <div className="inline-actions wrap">
                      <button className="primary-btn" type="button" onClick={handleRoutineSave}>
                        루틴 저장
                      </button>
                      <button className="danger-btn" type="button" onClick={handleRoutineDelete}>
                        루틴 삭제
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sub-card">
                  <h3>관리자 전용 메모</h3>
                  <label className="field">
                    <span>비공개 메모 입력</span>
                    <textarea rows="4" value={adminNoteInput} onChange={(e) => setAdminNoteInput(e.target.value)} />
                  </label>
                  <button className="primary-btn" type="button" onClick={handleAdminNoteSave}>
                    메모 저장
                  </button>

                  <div className="list-stack">
                    {adminNotes.map((note) => (
                      <div key={note.id} className="list-card">
                        <div className="compact-text">{note.note}</div>
                        <div className="compact-text">수정일: {note.updated_at?.slice(0, 10) || '-'}</div>
                        <button className="danger-btn" type="button" onClick={() => handleAdminNoteDelete(note.id)}>
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sub-card">
                  <h3>회원 건강정보</h3>
                  <div className="list-stack">
                    {memberHealthLogs.length === 0 ? <div className="compact-text">등록된 건강정보가 없습니다.</div> : null}
                    {memberHealthLogs.map((health) => {
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

                          {!collapsed ? (
                            <div className="detail-box">
                              <p><strong>키:</strong> {health.height_cm || '-'}</p>
                              <p><strong>체중:</strong> {health.weight_kg || '-'}</p>
                              <p><strong>체지방:</strong> {health.body_fat_percent || '-'}</p>
                              <p><strong>골격근량:</strong> {health.skeletal_muscle_mass || '-'}</p>
                              <p><strong>병력사항:</strong> {health.medical_history || '-'}</p>
                              <p><strong>회원 메모:</strong> {health.member_note || '-'}</p>
                              <p><strong>인바디 이미지 URL:</strong> {health.inbody_image_url || '-'}</p>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      )}

      {activeTab === '기록작성' && (
        <div className="two-col">
          <section className="card">
            <h2>운동 기록 작성 / 수정</h2>
            <form className="stack-gap" onSubmit={handleWorkoutSubmit}>
              <div className="grid-2">
                <label className="field">
                  <span>회원 선택</span>
                  <select value={workoutForm.member_id} onChange={(e) => setWorkoutForm({ ...workoutForm, member_id: e.target.value })}>
                    <option value="">회원 선택</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>날짜</span>
                  <input
                    type="date"
                    value={workoutForm.workout_date}
                    onChange={(e) => setWorkoutForm({ ...workoutForm, workout_date: e.target.value })}
                  />
                </label>
              </div>

              <label className="field">
                <span>기록 타입</span>
                <select value={workoutForm.workout_type} onChange={(e) => setWorkoutForm({ ...workoutForm, workout_type: e.target.value })}>
                  <option value="pt">PT</option>
                  <option value="personal">개인운동</option>
                </select>
              </label>

              <div className="stack-gap">
                {workoutForm.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="sub-card">
                    <div className="list-card-top">
                      <strong>운동 {itemIndex + 1}</strong>
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => removeWorkoutItem(itemIndex)}
                        disabled={workoutForm.items.length === 1}
                      >
                        운동 삭제
                      </button>
                    </div>

                    <label className="field">
                      <span>운동DB 선택</span>
                      <select value={item.exercise_id} onChange={(e) => updateWorkoutItemSelect(itemIndex, e.target.value)}>
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
                        onChange={(e) => updateWorkoutItemName(itemIndex, e.target.value)}
                        placeholder="예: 힙쓰러스트, 밴드 워크, 스쿼트"
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

                <button type="button" className="secondary-btn" onClick={addWorkoutItem}>
                  운동 추가
                </button>
              </div>

              <label className="field">
                <span>잘한점</span>
                <textarea rows="3" value={workoutForm.good} onChange={(e) => setWorkoutForm({ ...workoutForm, good: e.target.value })} />
              </label>

              <label className="field">
                <span>보완점</span>
                <textarea rows="3" value={workoutForm.improve} onChange={(e) => setWorkoutForm({ ...workoutForm, improve: e.target.value })} />
              </label>

              <div className="inline-actions wrap">
                <button className="primary-btn" type="submit">
                  {workoutForm.id ? '운동 기록 수정' : '운동 기록 저장'}
                </button>
                <button type="button" className="secondary-btn" onClick={resetWorkoutForm}>
                  작성 초기화
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>운동 기록 목록</h2>
            <div className="list-stack">
              {workouts.map((workout) => {
                const member = members.find((item) => item.id === workout.member_id)
                const items = workoutItemsMap[workout.id] || []
                const collapsed = collapsedWorkouts[workout.id] ?? true

                return (
                  <div key={workout.id} className="list-card">
                    <div className="list-card-top">
                      <strong>{member?.name || '회원없음'} / {workout.workout_type === 'pt' ? 'PT' : '개인운동'}</strong>
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

                      <button type="button" className="secondary-btn" onClick={() => handleWorkoutEdit(workout)}>
                        수정
                      </button>

                      <button type="button" className="danger-btn" onClick={() => handleWorkoutDelete(workout)}>
                        삭제
                      </button>
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
          </section>
        </div>
      )}

      {activeTab === '운동DB' && (
        <div className="two-col">
          <section className="card">
            <h2>브랜드 관리</h2>
            <form className="stack-gap" onSubmit={handleBrandSubmit}>
              <label className="field">
                <span>브랜드명</span>
                <input value={brandForm.name} onChange={(e) => setBrandForm({ name: e.target.value })} />
              </label>

              <div className="inline-actions wrap">
                <button className="primary-btn" type="submit">
                  {editingBrandId ? '브랜드 수정' : '브랜드 추가'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setBrandForm(emptyBrandForm)
                    setEditingBrandId(null)
                  }}
                >
                  초기화
                </button>
              </div>
            </form>

            <div className="list-stack">
              {brands.map((brand) => (
                <div key={brand.id} className="list-card">
                  <div className="list-card-top">
                    <strong>{brand.name}</strong>
                  </div>
                  <div className="inline-actions wrap">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setEditingBrandId(brand.id)
                        setBrandForm({ name: brand.name })
                      }}
                    >
                      수정
                    </button>
                    <button type="button" className="danger-btn" onClick={() => handleBrandDelete(brand.id)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>운동 관리</h2>
              <button type="button" className="secondary-btn" onClick={() => setShowBulkInput((prev) => !prev)}>
                {showBulkInput ? '개별 입력만 보기' : '일괄 입력 열기'}
              </button>
            </div>

            <form className="stack-gap" onSubmit={handleExerciseSubmit}>
              <label className="field">
                <span>운동명</span>
                <input value={exerciseForm.name} onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })} />
              </label>

              <div className="grid-3">
                <label className="field">
                  <span>부위</span>
                  <input value={exerciseForm.body_part} onChange={(e) => setExerciseForm({ ...exerciseForm, body_part: e.target.value })} />
                </label>
                <label className="field">
                  <span>카테고리</span>
                  <input value={exerciseForm.category} onChange={(e) => setExerciseForm({ ...exerciseForm, category: e.target.value })} />
                </label>
                <label className="field">
                  <span>브랜드</span>
                  <select value={exerciseForm.brand_id} onChange={(e) => setExerciseForm({ ...exerciseForm, brand_id: e.target.value })}>
                    <option value="">선택 안함</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="inline-actions wrap">
                <button className="primary-btn" type="submit">
                  {editingExerciseId ? '운동 수정' : '운동 추가'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setEditingExerciseId(null)
                    setExerciseForm(emptyExerciseForm)
                  }}
                >
                  초기화
                </button>
              </div>
            </form>

            {showBulkInput ? (
              <div className="sub-card">
                <h3>운동DB 일괄 입력</h3>
                <p className="sub-text">형식: 브랜드|운동명|부위|카테고리</p>
                <label className="field">
                  <span>여러 줄 입력</span>
                  <textarea rows="8" value={bulkExerciseText} onChange={(e) => setBulkExerciseText(e.target.value)} />
                </label>
                <button type="button" className="primary-btn" onClick={handleBulkExerciseInsert}>
                  일괄 등록
                </button>
              </div>
            ) : null}

            <label className="field">
              <span>검색</span>
              <input value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="운동명 / 브랜드 / 부위" />
            </label>

            <div className="list-stack">
              {filteredExercises.map((exercise) => {
                const collapsed = collapsedExercises[exercise.id] ?? true
                return (
                  <div key={exercise.id} className="list-card">
                    <div className="list-card-top">
                      <strong>{exercise.name}</strong>
                      <span className="pill">{exercise.brands?.name || '브랜드없음'}</span>
                    </div>

                    <div className="compact-text">
                      간략히보기: {exercise.body_part || '-'} / {exercise.category || '-'}
                    </div>

                    <div className="inline-actions wrap">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() =>
                          setCollapsedExercises((prev) => ({
                            ...prev,
                            [exercise.id]: !collapsed,
                          }))
                        }
                      >
                        {collapsed ? '상세히보기' : '간략히보기'}
                      </button>

                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          setEditingExerciseId(exercise.id)
                          setExerciseForm({
                            name: exercise.name || '',
                            body_part: exercise.body_part || '',
                            category: exercise.category || '',
                            brand_id: exercise.brand_id || '',
                          })
                        }}
                      >
                        수정
                      </button>

                      <button type="button" className="danger-btn" onClick={() => handleExerciseDelete(exercise.id)}>
                        삭제
                      </button>
                    </div>

                    {!collapsed ? (
                      <div className="detail-box">
                        <p><strong>운동명:</strong> {exercise.name}</p>
                        <p><strong>브랜드:</strong> {exercise.brands?.name || '-'}</p>
                        <p><strong>부위:</strong> {exercise.body_part || '-'}</p>
                        <p><strong>카테고리:</strong> {exercise.category || '-'}</p>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === '식단' && (
        <div className="card">
          <div className="section-head">
            <h2>식단 기록</h2>
            <select value={dietMemberFilter} onChange={(e) => setDietMemberFilter(e.target.value)}>
              <option value="">전체 회원</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="list-stack">
            {displayedDietLogs.map((diet) => {
              const collapsed = collapsedDiets[diet.id] ?? true
              const member = members.find((item) => item.id === diet.member_id)

              return (
                <DietAdminCard
                  key={diet.id}
                  diet={diet}
                  memberName={member?.name || '회원없음'}
                  collapsed={collapsed}
                  onToggle={() =>
                    setCollapsedDiets((prev) => ({
                      ...prev,
                      [diet.id]: !collapsed,
                    }))
                  }
                  onSave={handleDietFeedbackSave}
                  onDelete={handleDietDelete}
                />
              )
            })}
          </div>
        </div>
      )}

      {activeTab === '통계' && (
        <div className="stack-gap">
          <div className="stats-grid">
            <div className="stat-card">
              <span>이번달 PT 수</span>
              <strong>{monthlyStats.ptCount}</strong>
            </div>
            <div className="stat-card">
              <span>이번달 개인운동 수</span>
              <strong>{monthlyStats.personalCount}</strong>
            </div>
            <div className="stat-card">
              <span>전체 남은 세션</span>
              <strong>{monthlyStats.remainingSessions}</strong>
            </div>
          </div>

          <div className="card">
            <h2>회원별 통계</h2>
            <div className="list-stack">
              {memberStats.map((member) => (
                <div key={member.id} className="list-card">
                  <div className="list-card-top">
                    <strong>{member.name}</strong>
                    <span className="pill">남은 {member.remainingSessions}회</span>
                  </div>
                  <div className="compact-text">
                    PT {member.ptCount}회 / 개인운동 {member.personalCount}회 / 총 세션 {member.total_sessions || 0}회
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === '코치스케줄' && (
        <div className="two-col">
          <section className="card">
            <h2>코치 스케줄 등록 / 수정</h2>

            <div className="stack-gap">
              <label className="field">
                <span>코치 선택</span>
                <select value={selectedCoachId} onChange={(e) => setSelectedCoachId(e.target.value)}>
                  <option value="">코치 선택</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>날짜</span>
                <input
                  type="date"
                  value={scheduleForm.schedule_date}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_date: e.target.value })}
                />
              </label>

              <div className="grid-2">
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={scheduleForm.is_working}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, is_working: e.target.checked })}
                  />
                  <span>근무일</span>
                </label>

                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={scheduleForm.is_weekend_work}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, is_weekend_work: e.target.checked })}
                  />
                  <span>주말 근무</span>
                </label>
              </div>

              <div className="grid-2">
                <label className="field">
                  <span>근무 시작</span>
                  <input
                    type="time"
                    value={scheduleForm.work_start}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, work_start: e.target.value })}
                    disabled={!scheduleForm.is_working}
                  />
                </label>

                <label className="field">
                  <span>근무 종료</span>
                  <input
                    type="time"
                    value={scheduleForm.work_end}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, work_end: e.target.value })}
                    disabled={!scheduleForm.is_working}
                  />
                </label>
              </div>

              <div className="field">
                <span>한가한 시간 체크</span>
                <div className="slot-grid">
                  {timeSlotOptions.map((slot) => {
                    const checked = scheduleForm.selectedSlots.includes(slot)
                    return (
                      <label key={slot} className={`slot-chip ${checked ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScheduleSlot(slot)}
                          disabled={!scheduleForm.is_working}
                        />
                        <span>{slot}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <label className="field">
                <span>메모</span>
                <textarea rows="4" value={scheduleForm.memo} onChange={(e) => setScheduleForm({ ...scheduleForm, memo: e.target.value })} />
              </label>

              <div className="inline-actions wrap">
                <button type="button" className="primary-btn" onClick={handleScheduleSave}>
                  스케줄 저장
                </button>
                <button type="button" className="secondary-btn" onClick={resetScheduleForm}>
                  초기화
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>월별 코치 스케줄</h2>
              <input type="month" value={scheduleMonth} onChange={(e) => setScheduleMonth(e.target.value)} />
            </div>

            <div className="list-stack">
              {filteredSchedules.map((schedule) => {
                const coach = coaches.find((item) => item.id === schedule.coach_id)
                const collapsed = collapsedSchedules[schedule.id] ?? true
                const slots = coachScheduleSlotsMap[schedule.id] || []

                return (
                  <div key={schedule.id} className="list-card">
                    <div className="list-card-top">
                      <strong>{coach?.name || '코치없음'} / {schedule.schedule_date}</strong>
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

                      <button type="button" className="secondary-btn" onClick={() => handleScheduleEdit(schedule)}>
                        수정
                      </button>

                      <button type="button" className="danger-btn" onClick={() => handleScheduleDelete(schedule.id)}>
                        삭제
                      </button>
                    </div>

                    {!collapsed ? (
                      <div className="detail-box">
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
          </section>
        </div>
      )}

      {activeTab === '매출기록' && (
        <div className="stack-gap">
          <div className="two-col">
            <section className="card">
              <h2>매출 기록 입력 / 수정</h2>
              <form className="stack-gap" onSubmit={handleSaleSubmit}>
                <div className="grid-2">
                  <label className="field">
                    <span>회원</span>
                    <select value={saleForm.member_id} onChange={(e) => setSaleForm({ ...saleForm, member_id: e.target.value })}>
                      <option value="">선택 안함</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>프로그램</span>
                    <select value={saleForm.program_id} onChange={(e) => setSaleForm({ ...saleForm, program_id: e.target.value })}>
                      <option value="">선택 안함</option>
                      {programs.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid-2">
                  <label className="field">
                    <span>결제일</span>
                    <input type="date" value={saleForm.sale_date} onChange={(e) => setSaleForm({ ...saleForm, sale_date: e.target.value })} />
                  </label>

                  <label className="field">
                    <span>금액</span>
                    <input type="number" value={saleForm.amount} onChange={(e) => setSaleForm({ ...saleForm, amount: e.target.value })} />
                  </label>
                </div>

                <div className="grid-2">
                  <label className="field">
                    <span>결제방법</span>
                    <select value={saleForm.payment_method} onChange={(e) => setSaleForm({ ...saleForm, payment_method: e.target.value })}>
                      <option value="현금">현금</option>
                      <option value="카드">카드</option>
                      <option value="이체">이체</option>
                      <option value="할부">할부</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>할부 개월수</span>
                    <input
                      type="number"
                      value={saleForm.installment_months}
                      onChange={(e) => setSaleForm({ ...saleForm, installment_months: e.target.value })}
                    />
                  </label>
                </div>

                <div className="grid-2">
                  <label className="field">
                    <span>구매 세션</span>
                    <input
                      type="number"
                      value={saleForm.purchased_session_count}
                      onChange={(e) => setSaleForm({ ...saleForm, purchased_session_count: e.target.value })}
                    />
                  </label>

                  <label className="field">
                    <span>서비스 세션</span>
                    <input
                      type="number"
                      value={saleForm.service_session_count}
                      onChange={(e) => setSaleForm({ ...saleForm, service_session_count: e.target.value })}
                    />
                  </label>
                </div>

                <div className="grid-2">
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={saleForm.cash_receipt_issued}
                      onChange={(e) => setSaleForm({ ...saleForm, cash_receipt_issued: e.target.checked })}
                    />
                    <span>현금영수증 발행</span>
                  </label>

                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={saleForm.is_vip}
                      onChange={(e) => setSaleForm({ ...saleForm, is_vip: e.target.checked })}
                    />
                    <span>VIP</span>
                  </label>
                </div>

                <label className="field">
                  <span>메모</span>
                  <textarea rows="4" value={saleForm.memo} onChange={(e) => setSaleForm({ ...saleForm, memo: e.target.value })} />
                </label>

                <div className="inline-actions wrap">
                  <button className="primary-btn" type="submit">
                    {editingSaleId ? '매출 수정' : '매출 저장'}
                  </button>
                  <button type="button" className="secondary-btn" onClick={resetSaleForm}>
                    초기화
                  </button>
                </div>
              </form>
            </section>

            <section className="card">
              <div className="section-head">
                <h2>월별 매출 요약</h2>
                <input type="month" value={saleMonth} onChange={(e) => setSaleMonth(e.target.value)} />
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span>총 매출</span>
                  <strong>{Number(salesSummary?.total_sales || 0).toLocaleString()}</strong>
                </div>
                <div className="stat-card">
                  <span>등록 건수</span>
                  <strong>{Number(salesSummary?.total_count || 0)}</strong>
                </div>
                <div className="stat-card">
                  <span>VIP 결제 수</span>
                  <strong>{Number(salesSummary?.vip_sales_count || 0)}</strong>
                </div>
              </div>

              <div className="detail-box">
                <p><strong>현금:</strong> {Number(salesSummary?.cash_sales || 0).toLocaleString()}</p>
                <p><strong>카드:</strong> {Number(salesSummary?.card_sales || 0).toLocaleString()}</p>
                <p><strong>이체:</strong> {Number(salesSummary?.transfer_sales || 0).toLocaleString()}</p>
                <p><strong>할부:</strong> {Number(salesSummary?.installment_sales || 0).toLocaleString()}</p>
                <p><strong>자동 피드백:</strong> {getSalesAutoFeedback()}</p>
              </div>
            </section>
          </div>

          <div className="card">
            <h2>매출 목록</h2>
            <div className="list-stack">
              {filteredSales.map((sale) => (
                <div key={sale.id} className="list-card">
                  <div className="list-card-top">
                    <strong>{sale.members?.name || '회원없음'} / {sale.programs?.name || '프로그램없음'}</strong>
                    <span className="pill">{sale.sale_date}</span>
                  </div>
                  <div className="compact-text">
                    {Number(sale.amount || 0).toLocaleString()}원 / {sale.payment_method} / 구매 {sale.purchased_session_count}회 / 서비스 {sale.service_session_count}회
                  </div>
                  <div className="inline-actions wrap">
                    <button className="secondary-btn" type="button" onClick={() => handleSaleEdit(sale)}>
                      수정
                    </button>
                    <button className="danger-btn" type="button" onClick={() => handleSaleDelete(sale.id)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === '프로그램' && (
        <div className="two-col">
          <section className="card">
            <h2>프로그램 등록 / 수정</h2>
            <form className="stack-gap" onSubmit={handleProgramSubmit}>
              <label className="field">
                <span>프로그램명</span>
                <input value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} />
              </label>

              <div className="grid-2">
                <label className="field">
                  <span>가격</span>
                  <input type="number" value={programForm.price} onChange={(e) => setProgramForm({ ...programForm, price: e.target.value })} />
                </label>
                <label className="field">
                  <span>횟수</span>
                  <input type="number" value={programForm.session_count} onChange={(e) => setProgramForm({ ...programForm, session_count: e.target.value })} />
                </label>
              </div>

              <label className="field">
                <span>설명</span>
                <textarea rows="5" value={programForm.description} onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} />
              </label>

              <div className="grid-2">
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={programForm.is_vip}
                    onChange={(e) => setProgramForm({ ...programForm, is_vip: e.target.checked })}
                  />
                  <span>VIP 프로그램</span>
                </label>

                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={programForm.is_active}
                    onChange={(e) => setProgramForm({ ...programForm, is_active: e.target.checked })}
                  />
                  <span>활성 상태</span>
                </label>
              </div>

              <div className="inline-actions wrap">
                <button className="primary-btn" type="submit">
                  {editingProgramId ? '프로그램 수정' : '프로그램 추가'}
                </button>
                <button type="button" className="secondary-btn" onClick={resetProgramForm}>
                  초기화
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>프로그램 목록</h2>
            <div className="list-stack">
              {programs.map((program) => (
                <div key={program.id} className="list-card">
                  <div className="list-card-top">
                    <strong>{program.name}</strong>
                    <span className="pill">{program.is_vip ? 'VIP' : '일반'}</span>
                  </div>
                  <div className="compact-text">
                    {Number(program.price || 0).toLocaleString()}원 / {program.session_count}회 / {program.is_active ? '활성' : '비활성'}
                  </div>
                  <div className="inline-actions wrap">
                    <button className="secondary-btn" type="button" onClick={() => handleProgramEdit(program)}>
                      수정
                    </button>
                    <button className="danger-btn" type="button" onClick={() => handleProgramDelete(program.id)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === '공지사항' && (
        <div className="two-col">
          <section className="card">
            <h2>공지 / 이벤트 등록</h2>
            <form className="stack-gap" onSubmit={handleNoticeSubmit}>
              <label className="field">
                <span>제목</span>
                <input value={noticeForm.title} onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })} />
              </label>

              <label className="field">
                <span>카테고리</span>
                <select value={noticeForm.category} onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}>
                  <option value="공지">공지</option>
                  <option value="이벤트">이벤트</option>
                  <option value="운동영상">운동영상</option>
                </select>
              </label>

              <label className="field">
                <span>내용</span>
                <textarea rows="6" value={noticeForm.content} onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })} />
              </label>

              <label className="field">
                <span>이미지 URL</span>
                <input value={noticeForm.image_url} onChange={(e) => setNoticeForm({ ...noticeForm, image_url: e.target.value })} />
              </label>

              <label className="field">
                <span>영상 URL</span>
                <input value={noticeForm.video_url} onChange={(e) => setNoticeForm({ ...noticeForm, video_url: e.target.value })} />
              </label>

              <div className="grid-2">
                <label className="field">
                  <span>시작일</span>
                  <input type="date" value={noticeForm.starts_at} onChange={(e) => setNoticeForm({ ...noticeForm, starts_at: e.target.value })} />
                </label>

                <label className="field">
                  <span>종료일</span>
                  <input type="date" value={noticeForm.ends_at} onChange={(e) => setNoticeForm({ ...noticeForm, ends_at: e.target.value })} />
                </label>
              </div>

              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={noticeForm.is_published}
                  onChange={(e) => setNoticeForm({ ...noticeForm, is_published: e.target.checked })}
                />
                <span>게시중</span>
              </label>

              <div className="inline-actions wrap">
                <button className="primary-btn" type="submit">
                  {editingNoticeId ? '공지 수정' : '공지 등록'}
                </button>
                <button type="button" className="secondary-btn" onClick={resetNoticeForm}>
                  초기화
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>공지 / 이벤트 목록</h2>
            <div className="list-stack">
              {notices.map((notice) => {
                const collapsed = collapsedNotices[notice.id] ?? true
                return (
                  <div key={notice.id} className="list-card">
                    <div className="list-card-top">
                      <strong>{notice.title}</strong>
                      <span className="pill">{notice.category}</span>
                    </div>

                    <div className="compact-text">
                      간략히보기: {notice.content.slice(0, 40)}{notice.content.length > 40 ? '...' : ''}
                    </div>

                    <div className="inline-actions wrap">
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() =>
                          setCollapsedNotices((prev) => ({
                            ...prev,
                            [notice.id]: !collapsed,
                          }))
                        }
                      >
                        {collapsed ? '상세히보기' : '간략히보기'}
                      </button>

                      <button className="secondary-btn" type="button" onClick={() => handleNoticeEdit(notice)}>
                        수정
                      </button>

                      <button className="danger-btn" type="button" onClick={() => handleNoticeDelete(notice.id)}>
                        삭제
                      </button>
                    </div>

                    {!collapsed ? (
                      <div className="detail-box">
                        <p><strong>내용:</strong> {notice.content || '-'}</p>
                        <p><strong>이미지 URL:</strong> {notice.image_url || '-'}</p>
                        <p><strong>영상 URL:</strong> {notice.video_url || '-'}</p>
                        <p><strong>기간:</strong> {formatDate(notice.starts_at)} ~ {formatDate(notice.ends_at)}</p>
                        <p><strong>게시상태:</strong> {notice.is_published ? '게시중' : '숨김'}</p>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === '사용방법' && (
        <div className="card">
          <div className="section-head">
            <h2>사용방법 관리</h2>
            <select value={manualTarget} onChange={(e) => setManualTarget(e.target.value)}>
              <option value="member">회원용</option>
              <option value="admin">관리자용</option>
            </select>
          </div>

          <div className="stack-gap">
            <label className="field">
              <span>제목</span>
              <input value={manualForm.title} onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })} />
            </label>

            <label className="field">
              <span>내용</span>
              <textarea rows="10" value={manualForm.content} onChange={(e) => setManualForm({ ...manualForm, content: e.target.value })} />
            </label>

            <div className="inline-actions wrap">
              <button className="primary-btn" type="button" onClick={handleManualSave}>
                저장
              </button>
              <button className="danger-btn" type="button" onClick={handleManualDelete}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DietAdminCard({ diet, memberName, collapsed, onToggle, onSave, onDelete }) {
  const [feedback, setFeedback] = useState(diet.coach_feedback || '')

  useEffect(() => {
    setFeedback(diet.coach_feedback || '')
  }, [diet.coach_feedback])

  return (
    <div className="list-card">
      <div className="list-card-top">
        <strong>{memberName}</strong>
        <span className="pill">{diet.log_date}</span>
      </div>

      <div className="compact-text">
        간략히보기: {diet.meal_type || '식단'} / {diet.meal_time || '-'} / {diet.content?.slice(0, 24) || ''}
        {diet.content?.length > 24 ? '...' : ''}
      </div>

      <div className="inline-actions wrap">
        <button type="button" className="secondary-btn" onClick={onToggle}>
          {collapsed ? '상세히보기' : '간략히보기'}
        </button>

        <button type="button" className="danger-btn" onClick={() => onDelete(diet.id)}>
          삭제
        </button>
      </div>

      {!collapsed ? (
        <DietFeedbackEditor diet={diet} feedback={feedback} setFeedback={setFeedback} onSave={onSave} />
      ) : null}
    </div>
  )
}

function DietFeedbackEditor({ diet, feedback, setFeedback, onSave }) {
  const [local, setLocal] = useState({
    meal_type: diet.meal_type || '식단',
    meal_time: diet.meal_time || '',
    carb_g: diet.carb_g || 0,
    protein_g: diet.protein_g || 0,
    fat_g: diet.fat_g || 0,
    product_brand: diet.product_brand || '',
    product_name: diet.product_name || '',
    meal_category: diet.meal_category || '일반식',
    hunger_level: diet.hunger_level || 0,
    member_note: diet.member_note || '',
    content: diet.content || '',
  })

  useEffect(() => {
    setLocal({
      meal_type: diet.meal_type || '식단',
      meal_time: diet.meal_time || '',
      carb_g: diet.carb_g || 0,
      protein_g: diet.protein_g || 0,
      fat_g: diet.fat_g || 0,
      product_brand: diet.product_brand || '',
      product_name: diet.product_name || '',
      meal_category: diet.meal_category || '일반식',
      hunger_level: diet.hunger_level || 0,
      member_note: diet.member_note || '',
      content: diet.content || '',
    })
  }, [diet])

  return (
    <div className="detail-box stack-gap">
      <p><strong>식단 종류:</strong> {local.meal_type}</p>
      <p><strong>시간:</strong> {local.meal_time || '-'}</p>
      <p><strong>내용:</strong> {local.content || '-'}</p>
      <p><strong>탄수/단백질/지방:</strong> {local.carb_g || 0}g / {local.protein_g || 0}g / {local.fat_g || 0}g</p>
      <p><strong>제품:</strong> {local.product_brand || '-'} / {local.product_name || '-'}</p>
      <p><strong>식사 유형:</strong> {local.meal_category || '-'}</p>
      <p><strong>배고픔 정도:</strong> {local.hunger_level || 0}</p>
      <p><strong>회원 메모:</strong> {local.member_note || '-'}</p>

      <label className="field">
        <span>코치 피드백</span>
        <textarea rows="4" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </label>

      <button
        type="button"
        className="primary-btn"
        onClick={() =>
          onSave(diet.id, {
            coach_feedback: feedback,
          })
        }
      >
        피드백 저장
      </button>
    </div>
  )
}
