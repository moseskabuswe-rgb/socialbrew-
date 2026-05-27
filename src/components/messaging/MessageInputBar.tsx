import { useState, useRef } from 'react'
import { Send, ImageIcon, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export interface Attachment {
  url: string
  mimeType: string
  previewUrl: string
}

export interface ReplyTo {
  id: string
  content: string
  senderName: string
  attachmentUrl?: string | null
}

interface Props {
  onSend: (text: string, attachment?: Attachment, replyToId?: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
  replyTo?: ReplyTo | null
  onCancelReply?: () => void
  currentUserId: string
}

export default function MessageInputBar({
  onSend,
  placeholder = 'Message...',
  disabled,
  replyTo,
  onCancelReply,
  currentUserId,
}: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${currentUserId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(data.path)
      setAttachment({
        url: urlData.publicUrl,
        mimeType: file.type,
        previewUrl: URL.createObjectURL(file),
      })
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleSend() {
    if ((!text.trim() && !attachment) || sending || disabled) return
    setSending(true)
    const att = attachment
    const replyId = replyTo?.id
    setText('')
    setAttachment(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await onSend(text.trim(), att || undefined, replyId)
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

  const canSend = (!!text.trim() || !!attachment) && !sending && !uploading && !disabled

  return (
    <div className="bg-white border-t border-gray-100 flex-shrink-0">
      {/* Reply preview strip */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 border-b border-gray-50">
          <div className="w-0.5 self-stretch bg-caramel rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-caramel">{replyTo.senderName}</p>
            {replyTo.attachmentUrl
              ? <p className="text-xs text-gray-400">📷 Photo</p>
              : <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>}
          </div>
          <button onClick={onCancelReply} className="text-gray-400 p-1 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div className="px-3 pt-2 pb-1">
          <div className="relative inline-block">
            <img src={attachment.previewUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />
            <button
              onClick={() => setAttachment(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center"
            >
              <X size={10} className="text-white" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleImagePick}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading || sending}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-caramel transition-colors disabled:opacity-40"
        >
          {uploading
            ? <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            : <ImageIcon size={20} />}
        </button>
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
          disabled={!canSend}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-40"
          style={{ background: canSend ? '#c8853a' : '#e5e7eb' }}
        >
          <Send size={16} className={canSend ? 'text-white' : 'text-gray-400'} />
        </button>
      </div>
    </div>
  )
}
