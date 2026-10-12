import { hasMeaningfulText, localDate, newId, type AppData, type EvidenceType, type ModuleId } from './model'

export const MODULES = [
  { id: 'confidence', number: 'I', title: 'Build Confidence', description: 'Record effort, success, progress, and the next action.', time: '3 min' },
  { id: 'prepare', number: 'II', title: 'Prepare to Perform', description: 'Prepare for a specific challenge through evidence review, breathing, focus cues, and mental rehearsal.', time: '1–5 min' },
  { id: 'pressure', number: 'III', title: 'Manage Pressure', description: 'Use a short breathing and attention-reset routine during moments of pressure.', time: '90 sec' },
  { id: 'setbacks', number: 'IV', title: 'Learn from Setbacks', description: 'Separate facts from interpretation, identify lessons, and select the next controllable action.', time: '4 min' },
] as const

export interface ExerciseStep {
  key: string
  type: 'text' | 'evidence' | 'choice' | 'breath' | 'timer'
  label: string
  prompt: string
  hint: string
  placeholder?: string
  seconds?: number
}

export function getSteps(module: ModuleId, expanded = false): ExerciseStep[] {
  if (module === 'confidence') return [
    { key: 'effort', type: 'text', label: 'Effort', prompt: 'What effort did you put in?', hint: 'Describe something you worked at. Partial entries are welcome.', placeholder: 'Ran the full set twice at match tempo' },
    { key: 'success', type: 'text', label: 'Success', prompt: 'What went well?', hint: 'One specific moment is enough. Small examples count.', placeholder: 'Held my line on the second climb' },
    { key: 'progress', type: 'text', label: 'Progress', prompt: 'What is better than before?', hint: 'What can you do now that was harder before?', placeholder: 'Recovered faster between intervals' },
    { key: 'next', type: 'text', label: 'Next action', prompt: 'What is your next action?', hint: 'Small, specific, and within your control.', placeholder: 'Book a session for Thursday morning' },
  ]
  const breathing: ExerciseStep = { key: 'breath', type: 'breath', label: 'Breathing', prompt: 'Take a comfortable pause.', hint: 'Let your breathing stay unforced. The circle is an optional guide; skip it whenever you want.', seconds: module === 'prepare' && !expanded ? 30 : 60 }
  if (module === 'prepare') return [
    { key: 'routine', type: 'choice', label: 'Routine', prompt: 'How much time do you have?', hint: 'Both end with a focus cue and a first action.' },
    { key: 'challenge', type: 'text', label: 'Challenge', prompt: 'What are you preparing for?', hint: 'Name the event and when it happens.', placeholder: 'Client pitch, Thursday 10:00' },
    { key: 'evidence', type: 'evidence', label: 'Evidence', prompt: 'What evidence can you draw on?', hint: 'Select one relevant example, or add evidence from your own preparation.', placeholder: 'Ran the full pitch twice without notes' },
    breathing,
    ...(expanded ? [
      { key: 'difficulty', type: 'text' as const, label: 'Difficulty', prompt: 'What might be difficult?', hint: 'Name one likely difficulty.', placeholder: 'A hard question about the budget' },
      { key: 'plan', type: 'text' as const, label: 'If–then plan', prompt: 'If that happens, what will you do?', hint: 'Write it as “If …, then I will …”.', placeholder: 'If I am asked about budget, I will pause and answer the part I know first' },
    ] : []),
    { key: 'cue', type: 'text', label: 'Focus cue', prompt: 'Choose a focus cue.', hint: 'A short phrase about the task to return to under pressure.', placeholder: 'Slow and clear' },
    ...(expanded ? [
      { key: 'setting', type: 'text' as const, label: 'Setting', prompt: 'Imagine the setting.', hint: 'What will you see, hear, or notice?', placeholder: 'A quiet room, the screen behind me, colleagues at the table' },
      { key: 'actions', type: 'text' as const, label: 'Rehearsal actions', prompt: 'Rehearse two or three specific actions.', hint: 'Write the sequence you want to practise.', placeholder: 'Stand comfortably, state the goal, pause for the first question' },
      { key: 'rehearse', type: 'timer' as const, label: 'Rehearsal', prompt: 'Rehearse the opening.', hint: 'Picture your setting and actions. Include the difficulty and your planned response. The timer is optional.', seconds: 60 },
    ] : []),
    { key: 'first', type: 'text', label: 'First action', prompt: 'What will you do first when it starts?', hint: 'The very first action gives your attention somewhere to go.', placeholder: 'Breathe out, then greet the room' },
  ]
  if (module === 'pressure') return [breathing,
    { key: 'see', type: 'text', label: 'Attention', prompt: 'Name three things you can see or hear.', hint: 'Typing is optional; noticing them quietly works too.', placeholder: 'Clock, footsteps, blue chair' },
    { key: 'next', type: 'text', label: 'Next action', prompt: 'What is the next thing you control?', hint: 'One action you can take in the next minute.', placeholder: 'Reset my feet and read the first line' },
  ]
  return [
    { key: 'facts', type: 'text', label: 'Facts', prompt: 'What happened?', hint: 'Record observable facts.', placeholder: 'Missed two serves in the final game' },
    { key: 'story', type: 'text', label: 'Interpretation', prompt: 'What meaning did you give it?', hint: 'Write the thought as it sounds in your head.', placeholder: 'I tighten up when it matters' },
    { key: 'alt', type: 'text', label: 'Other view', prompt: 'Is there another reading of the facts?', hint: 'Optional. You do not need to make a difficult experience positive.' },
    { key: 'lesson', type: 'text', label: 'Lesson', prompt: 'What is one lesson to keep?', hint: 'Something you can use next time.', placeholder: 'Take the full routine before every serve' },
    { key: 'next', type: 'text', label: 'Next action', prompt: 'What is the next controllable action?', hint: 'Specific, and within your control this week.', placeholder: 'Practise the serve routine for ten minutes on Tuesday' },
  ]
}

export interface SessionInput {
  module: ModuleId
  answers: Record<string, string>
  complete: boolean
  durationSeconds: number
  bankFields?: string[]
  confidenceItemId?: string
}

export function addSession(data: AppData, input: SessionInput, date = new Date()): { data: AppData; id: string } | null {
  const answers = Object.fromEntries(Object.entries(input.answers).map(([key, value]) => [key, value.trim()]))
  const expanded = answers.routine === 'expanded'
  const meaningfulKeys = getSteps(input.module, expanded).filter((step) => step.type !== 'choice').map((step) => step.key)
  const selected = input.module === 'prepare' ? data.confidenceItems.find((item) => item.id === input.confidenceItemId) : undefined
  if (!hasMeaningfulText(...meaningfulKeys.map((key) => answers[key])) && !selected) return null
  const next = structuredClone(data)
  const now = date.toISOString()
  const id = newId()
  const meta = { id, createdAt: now, updatedAt: now, localDate: localDate(date), complete: input.complete, durationSeconds: input.durationSeconds }
  if (input.module === 'confidence') {
    next.practiceEntries.unshift({ ...meta, effort: answers.effort || '', success: answers.success || '', progress: answers.progress || '', nextAction: answers.next || '' })
    const labels: Record<string, EvidenceType> = { effort: 'Effort', success: 'Success', progress: 'Progress' }
    for (const field of input.bankFields ?? []) {
      if (labels[field] && answers[field]) next.confidenceItems.unshift({ id: newId(), createdAt: now, updatedAt: now, title: labels[field], detail: answers[field], type: labels[field], sourcePracticeId: id })
    }
  } else if (input.module === 'prepare') {
    next.preparations.unshift({ ...meta, routine: expanded ? 'expanded' : 'quick', challenge: answers.challenge || '',
      ...(selected ? { confidenceItemId: selected.id, confidenceSnapshot: `${selected.title}: ${selected.detail}` } : {}),
      evidence: answers.evidence || '', breathing: answers.breath || '', focusCue: answers.cue || '', firstAction: answers.first || '',
      setting: expanded ? answers.setting || '' : '', rehearsalActions: expanded ? answers.actions || '' : '',
      likelyDifficulty: expanded ? answers.difficulty || '' : '', plannedResponse: expanded ? answers.plan || '' : '',
      rehearsal: expanded ? answers.rehearse || '' : '',
    })
  } else {
    next.reflectionSessions = [{ ...meta, module: input.module, answers: Object.fromEntries(meaningfulKeys.filter((key) => answers[key]).map((key) => [key, answers[key]])) }, ...(next.reflectionSessions ?? [])]
  }
  return { data: next, id }
}
