import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (text: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
}

export default function MessageInputBar({ onSend, placeholder = 'Message...', disabled }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending || disabled) return
    setSending(true)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await onSend(trimmed)
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div className="flex items-end gap-2 px-3 py-2 bg-white border-t border-gray-100">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || sending}
        rows={1}
        className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-caramel/30 resize-none overflow-hidden"
        style={{ minHeight: 40, maxHeight: 120 }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending || disabled}
        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full disabled:opacity-40 transition-colors"
        style={{ background: text.trim() ? '#c8853a' : '#e5e7eb' }}
      >
        <Send size={16} className={text.trim() ? 'text-white' : 'text-gray-400'} />
      </button>
    </div>
  )
}
