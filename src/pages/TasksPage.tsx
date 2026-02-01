import { useState, useRef } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { PageContainer } from '../components/PageContainer'
import { CreateTaskModal } from '../components/CreateTaskModal'
import api, { Task } from '../lib/api'
import { ChevronDown, Check } from 'lucide-react'

// Column configuration
const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-600' },
  { id: 'todo', label: 'To Do', color: 'bg-purple-500' },
  { id: 'doing', label: 'Doing', color: 'bg-blue-500' },
  { id: 'waiting', label: 'Waiting', color: 'bg-yellow-500' },
  { id: 'done', label: 'Done', color: 'bg-green-500' },
]

const priorityColors = {
  low: 'bg-slate-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
}

const categoryColors: Record<string, string> = {
  'Tech/AI': 'text-blue-400',
  'Personal': 'text-purple-400',
  'VIO Med Spa': 'text-emerald-400',
}

// Infer priority from task content if not set
function inferPriority(task: Task): 'low' | 'medium' | 'high' {
  if (task.priority) return task.priority
  const text = (task.title + (task.description || '')).toLowerCase()
  if (text.includes('urgent') || text.includes('asap') || text.includes('critical')) return 'high'
  if (text.includes('important') || text.includes('soon')) return 'medium'
  return 'low'
}

// Format relative time
function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

// Column Selector Dropdown Component
function ColumnSelector({ 
  currentColumn, 
  onColumnChange,
  isUpdating 
}: { 
  currentColumn: string
  onColumnChange: (newColumn: string) => void
  isUpdating: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const current = COLUMNS.find(c => c.id === currentColumn)
  
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        disabled={isUpdating}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isUpdating 
            ? 'bg-slate-700 text-slate-400 cursor-wait' 
            : 'bg-slate-700 hover:bg-slate-600 text-white active:scale-95'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${current?.color || 'bg-slate-500'}`} />
        <span>Move to: {current?.label || 'Select'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-0 right-0 mt-2 bg-slate-700 rounded-lg border border-slate-600 shadow-xl z-50 overflow-hidden"
          >
            {COLUMNS.map((col) => (
              <button
                key={col.id}
                onClick={(e) => {
                  e.stopPropagation()
                  if (col.id !== currentColumn) {
                    onColumnChange(col.id)
                  }
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                  col.id === currentColumn
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-600 hover:text-white'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${col.color}`} />
                <span className="flex-1">{col.label}</span>
                {col.id === currentColumn && (
                  <Check className="w-4 h-4 text-green-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(false)
          }} 
        />
      )}
    </div>
  )
}

// Task Card Component
function TaskCard({ task, isExpanded, onToggle, onColumnChange, isUpdating }: { 
  task: Task
  isExpanded: boolean
  onToggle: () => void
  onColumnChange: (taskId: string, newColumn: string) => void
  isUpdating: boolean
}) {
  const priority = inferPriority(task)
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-4"
      >
        <div className="flex items-start gap-3">
          {/* Priority indicator */}
          <div className={`w-1 h-full min-h-[3rem] rounded-full ${priorityColors[priority]}`} />
          
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium leading-tight">{task.title}</h3>
            
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {task.category && (
                <span className={`text-xs ${categoryColors[task.category] || 'text-slate-400'}`}>
                  {task.category}
                </span>
              )}
              <span className="text-xs text-slate-500">
                {timeAgo(task.updatedAt)}
              </span>
            </div>
          </div>
          
          {/* Expand indicator */}
          <motion.span 
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="text-slate-400 text-sm"
          >
            ▼
          </motion.span>
        </div>
      </button>
      
      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-slate-700">
              {task.description && (
                <p className="text-slate-300 text-sm mt-3 whitespace-pre-wrap">
                  {task.description}
                </p>
              )}
              
              {/* Move to column dropdown - prominent for mobile */}
              <div className="mt-4">
                <ColumnSelector
                  currentColumn={task.column}
                  onColumnChange={(newColumn) => onColumnChange(task.id, newColumn)}
                  isUpdating={isUpdating}
                />
              </div>
              
              <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                <span>{priority} priority</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Pull-to-refresh indicator
function PullIndicator({ pulling, refreshing }: { pulling: number; refreshing: boolean }) {
  if (!pulling && !refreshing) return null
  
  return (
    <motion.div 
      className="flex justify-center py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {refreshing ? (
        <div className="flex items-center gap-2 text-blue-400">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            ⟳
          </motion.span>
          <span className="text-sm">Refreshing...</span>
        </div>
      ) : (
        <div className="text-slate-400 text-sm">
          {pulling > 60 ? '↓ Release to refresh' : '↓ Pull to refresh'}
        </div>
      )}
    </motion.div>
  )
}

export function TasksPage() {
  const [activeColumn, setActiveColumn] = useState(0)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  
  // Fetch tasks with React Query
  const { data: tasks = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks(),
    staleTime: 30000, // 30 seconds
  })
  
  // Mutation for updating task column
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, column }: { taskId: string; column: string }) => 
      api.updateTask(taskId, { column }),
    onMutate: ({ taskId }) => {
      setUpdatingTaskId(taskId)
    },
    onSuccess: () => {
      // Refetch tasks to get updated data
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onSettled: () => {
      setUpdatingTaskId(null)
    },
  })
  
  const handleColumnChange = (taskId: string, newColumn: string) => {
    updateTaskMutation.mutate({ taskId, column: newColumn })
  }
  
  const handleTaskCreated = () => {
    // Invalidate and refetch tasks
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }
  
  // Group tasks by column
  const tasksByColumn = COLUMNS.map(col => ({
    ...col,
    tasks: tasks.filter((t: Task) => t.column === col.id),
  }))
  
  // Handle swipe between columns
  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 50
    if (info.offset.x < -threshold && activeColumn < COLUMNS.length - 1) {
      setActiveColumn(prev => prev + 1)
    } else if (info.offset.x > threshold && activeColumn > 0) {
      setActiveColumn(prev => prev - 1)
    }
  }
  
  // Handle pull-to-refresh
  const handlePullRefresh = async () => {
    if (pullDistance > 60 && !isRefetching) {
      await refetch()
    }
    setPullDistance(0)
  }
  
  const currentColumn = tasksByColumn[activeColumn]
  
  return (
    <PageContainer title="Tasks">
      {/* Column tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {tasksByColumn.map((col, idx) => (
          <button
            key={col.id}
            onClick={() => setActiveColumn(idx)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              idx === activeColumn
                ? `${col.color} text-white`
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {col.label}
            <span className="ml-1.5 opacity-70">
              {col.tasks.length}
            </span>
          </button>
        ))}
      </div>
      
      {/* Swipe hint */}
      <div className="text-center text-xs text-slate-500 mb-3">
        ← swipe to change column →
      </div>
      
      {/* Pull-to-refresh indicator */}
      <PullIndicator pulling={pullDistance} refreshing={isRefetching} />
      
      {/* Task list with swipe */}
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        onPan={(_, info) => {
          // Pull-to-refresh detection (when at top)
          if (info.offset.y > 0 && containerRef.current?.scrollTop === 0) {
            setPullDistance(info.offset.y)
          }
        }}
        onPanEnd={handlePullRefresh}
        className="min-h-[60vh]"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentColumn.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {isLoading ? (
              // Loading skeleton
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-slate-800 rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-700 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : currentColumn.tasks.length === 0 ? (
              // Empty state
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-slate-400">No tasks in {currentColumn.label}</p>
              </div>
            ) : (
              // Task cards
              currentColumn.tasks.map((task: Task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isExpanded={expandedTask === task.id}
                  onToggle={() => setExpandedTask(
                    expandedTask === task.id ? null : task.id
                  )}
                  onColumnChange={handleColumnChange}
                  isUpdating={updatingTaskId === task.id}
                />
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
      
      {/* Column indicator dots */}
      <div className="flex justify-center gap-2 mt-6">
        {COLUMNS.map((col, idx) => (
          <button
            key={col.id}
            onClick={() => setActiveColumn(idx)}
            className={`w-2 h-2 rounded-full transition-colors ${
              idx === activeColumn ? col.color : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
      
      {/* Add task FAB */}
      <button 
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-24 right-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-colors active:scale-95"
      >
        <span className="text-2xl">+</span>
      </button>
      
      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTaskCreated={handleTaskCreated}
        defaultColumn={COLUMNS[activeColumn]?.id || 'todo'}
      />
    </PageContainer>
  )
}
