import { useId, type ReactNode } from 'react'

export function Field({ label, hint, value, onChange, rows = 3, required = false }: {
  label: string; hint?: string; value: string; onChange: (value: string) => void; rows?: number; required?: boolean
}) {
  const id = useId()
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    <textarea id={id} aria-describedby={hint ? `${id}-hint` : undefined} rows={rows} required={required} value={value} onChange={(event) => onChange(event.target.value)} />
  </div>
}

export function Notice({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div>
}

export const formatDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(year, month - 1, day))
}

export const download = (contents: string, filename: string, type = 'application/json') => {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export type Commit = (next: import('./model').AppData) => 'saved' | 'memory' | false
