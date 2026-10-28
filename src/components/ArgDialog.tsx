import { useEffect, useRef, useState, type FormEvent } from 'react'
import { argUsage } from '../lib/flags.ts'
import type { Arg, Flag } from '../schema/index.ts'

interface Props {
  flag: Flag
  initial: Record<string, string> | undefined // undefined = adding, object = editing
  onSave: (values: Record<string, string>) => void
  onRemove: () => void
  onCancel: () => void
}

const label = (name: string) => name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

function problem(arg: Arg, value: string): string | null {
  const v = value.trim()
  if (!v) return arg.required ? 'Required' : null
  if (arg.type === 'number' && !Number.isFinite(Number(v))) return 'Must be a number'
  return null
}

// Popup for flags that take a value (-p, -T, --script ...). Opens as a modal <dialog>.
export function ArgDialog({ flag, initial, onSave, onRemove, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [values, setValues] = useState<Record<string, string>>(
    () => initial ?? Object.fromEntries(flag.args.map((a) => [a.name, ''])),
  )
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  const errors = Object.fromEntries(flag.args.map((a) => [a.name, problem(a, values[a.name] ?? '')]))
  const valid = Object.values(errors).every((e) => e === null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (valid) onSave(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])))
  }

  return (
    <dialog
      ref={ref}
      className="arg-dialog"
      aria-labelledby="arg-dialog-title"
      onCancel={(e) => {
        e.preventDefault() // Esc: let React unmount us instead of the browser closing the dialog
        onCancel()
      }}
      onClick={(e) => e.target === ref.current && onCancel()} // click on the backdrop
    >
      <form onSubmit={submit} noValidate>
        <p className="detail-flag">{flag.flag}</p>
        <h2 id="arg-dialog-title">{flag.name}</h2>
        <p className="dialog-summary">{flag.summary}</p>

        {flag.args.map((arg) => {
          const id = `arg-${flag.id}-${arg.name}`
          const err = touched ? errors[arg.name] : null
          return (
            <div key={arg.name} className="field">
              <label htmlFor={id}>
                {label(arg.name)}
                {!arg.required && <span className="optional"> (optional)</span>}
              </label>
              {arg.type === 'choice' ? (
                <select
                  id={id}
                  value={values[arg.name] ?? ''}
                  onChange={(e) => setValues({ ...values, [arg.name]: e.target.value })}
                  autoFocus={arg === flag.args[0]}
                >
                  <option value="">{arg.required ? 'Choose…' : 'None'}</option>
                  {arg.choices?.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.note ? `${c.value} · ${c.note}` : c.value}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  type="text"
                  inputMode={arg.type === 'number' ? 'decimal' : undefined}
                  placeholder={arg.placeholder ? `e.g. ${arg.placeholder}` : ''}
                  value={values[arg.name] ?? ''}
                  onChange={(e) => setValues({ ...values, [arg.name]: e.target.value })}
                  autoFocus={arg === flag.args[0]}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={`${id}-hint`}
                />
              )}
              <p id={`${id}-hint`} className={err ? 'field-error' : 'field-hint'}>
                {err ?? (
                  <>
                    Written as <code>{argUsage(flag, arg)}</code>
                    {arg.placeholder && arg.type !== 'choice' && (
                      <>
                        {' '}· example: <code>{arg.placeholder}</code>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          )
        })}

        <div className="dialog-actions">
          {initial && (
            <button type="button" className="btn btn-danger" onClick={onRemove}>
              Remove
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {initial ? 'Update' : 'Add to command'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
