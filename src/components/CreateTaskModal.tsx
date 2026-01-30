import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Mic, MicOff } from 'lucide-react'
import api from '../lib/api'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated: () => void
  defaultColumn?: string
}

const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'doing', label: 'Doing' },
  { id: 'waiting', label: 'Waiting' },
]

const CATEGORIES = [
  'Personal',
  'Tech/AI',
  'VIO Med Spa',
  'Other',
]

export function CreateTaskModal({ isOpen, onClose, onTaskCreated, defaultColumn = 'todo' }: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [column, setColumn] = useState(defaultColumn)
  const [category, setCategory] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceTarget, setVoiceTarget] = useState<'title' | 'description' | null>(null)
  
  const titleInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Focus title input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleInputRef.current?.focus(), 100)
    } else {
      // Reset form when closed
      setTitle('')
      setDescription('')
      setColumn(defaultColumn)
      setCategory(null)
      setError(null)
    }
  }, [isOpen, defaultColumn])

  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result: SpeechRecognitionResult) => result[0].transcript)
          .join('')
        
        if (voiceTarget === 'title') {
          setTitle(transcript)
        } else if (voiceTarget === 'description') {
          setDescription(transcript)
        }
      }

      recognition.onend = () => {
        setIsListening(false)
        setVoiceTarget(null)
      }

      recognition.onerror = () => {
        setIsListening(false)
        setVoiceTarget(null)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [voiceTarget])

  const startVoiceInput = (target: 'title' | 'description') => {
    if (!recognitionRef.current) {
      setError('Voice input not supported in this browser')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      setVoiceTarget(null)
    } else {
      setVoiceTarget(target)
      setIsListening(true)
      recognitionRef.current.start()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await api.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        column,
        category: category || undefined,
      })

      onTaskCreated()
      onClose()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-24 bg-slate-800 dark:bg-slate-800 light:bg-white rounded-2xl shadow-2xl z-50 max-h-[80vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 dark:border-slate-700 light:border-slate-200">
              <h2 className="text-lg font-semibold text-white dark:text-white light:text-slate-900">
                New Task
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-700 dark:hover:bg-slate-700 light:hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Title *
                </label>
                <div className="relative">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    className="w-full bg-slate-700 dark:bg-slate-700 light:bg-slate-100 border border-slate-600 dark:border-slate-600 light:border-slate-300 rounded-lg px-4 py-3 pr-12 text-white dark:text-white light:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => startVoiceInput('title')}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
                      isListening && voiceTarget === 'title'
                        ? 'bg-red-500 text-white'
                        : 'hover:bg-slate-600 text-slate-400'
                    }`}
                  >
                    {isListening && voiceTarget === 'title' ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Description
                </label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add more details..."
                    rows={3}
                    className="w-full bg-slate-700 dark:bg-slate-700 light:bg-slate-100 border border-slate-600 dark:border-slate-600 light:border-slate-300 rounded-lg px-4 py-3 pr-12 text-white dark:text-white light:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => startVoiceInput('description')}
                    className={`absolute right-2 top-3 p-2 rounded-full transition-colors ${
                      isListening && voiceTarget === 'description'
                        ? 'bg-red-500 text-white'
                        : 'hover:bg-slate-600 text-slate-400'
                    }`}
                  >
                    {isListening && voiceTarget === 'description' ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Column */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLUMNS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setColumn(col.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        column === col.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(category === cat ? null : cat)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        category === cat
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Task'
                )}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Types are declared in src/types/speech.d.ts
