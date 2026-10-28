import { useState } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked (e.g. http, permissions); the text is still selectable.
    }
  }
  return (
    <button type="button" className="copy" onClick={copy} aria-label={`Copy: ${text}`}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
