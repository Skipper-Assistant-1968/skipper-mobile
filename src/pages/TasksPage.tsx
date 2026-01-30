import { PageContainer } from '../components/PageContainer'

interface Task {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high'
}

const mockTasks: Task[] = [
  { id: '1', title: 'Set up PWA foundation', status: 'in-progress', priority: 'high' },
  { id: '2', title: 'Implement real-time chat', status: 'todo', priority: 'high' },
  { id: '3', title: 'Add push notifications', status: 'todo', priority: 'medium' },
  { id: '4', title: 'Design settings screen', status: 'todo', priority: 'low' },
]

const statusColors = {
  'todo': 'bg-slate-600',
  'in-progress': 'bg-blue-500',
  'done': 'bg-green-500',
}

const priorityColors = {
  'low': 'text-slate-400',
  'medium': 'text-yellow-400',
  'high': 'text-red-400',
}

export function TasksPage() {
  return (
    <PageContainer title="Tasks">
      <div className="space-y-3">
        {mockTasks.map((task) => (
          <div
            key={task.id}
            className="bg-slate-800 rounded-xl p-4 border border-slate-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="text-white font-medium">{task.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[task.status]} text-white`}>
                    {task.status}
                  </span>
                  <span className={`text-xs ${priorityColors[task.priority]}`}>
                    {task.priority} priority
                  </span>
                </div>
              </div>
              <button className="text-slate-400 hover:text-white p-1">
                •••
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <button className="fixed bottom-24 right-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-colors">
        <span className="text-2xl">+</span>
      </button>
    </PageContainer>
  )
}
