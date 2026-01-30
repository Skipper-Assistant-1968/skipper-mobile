import { PageContainer } from '../components/PageContainer'

interface ActivityItem {
  id: string
  type: 'message' | 'task' | 'agent' | 'system'
  title: string
  description: string
  time: string
}

const mockActivity: ActivityItem[] = [
  {
    id: '1',
    type: 'agent',
    title: 'Agent spawned',
    description: 'Main Agent started task: Set up PWA foundation',
    time: '2 min ago',
  },
  {
    id: '2',
    type: 'task',
    title: 'Task updated',
    description: 'PWA Foundation moved to in-progress',
    time: '5 min ago',
  },
  {
    id: '3',
    type: 'message',
    title: 'New message',
    description: 'Clark: "Set up the Skipper Mobile PWA"',
    time: '10 min ago',
  },
  {
    id: '4',
    type: 'system',
    title: 'Gateway connected',
    description: 'Successfully connected to Skipper gateway',
    time: '15 min ago',
  },
  {
    id: '5',
    type: 'system',
    title: 'Session started',
    description: 'New session initialized',
    time: '15 min ago',
  },
]

const typeIcons = {
  message: '💬',
  task: '✅',
  agent: '🤖',
  system: '⚙️',
}

const typeColors = {
  message: 'border-l-blue-500',
  task: 'border-l-green-500',
  agent: 'border-l-purple-500',
  system: 'border-l-slate-500',
}

export function ActivityPage() {
  return (
    <PageContainer title="Activity">
      <div className="space-y-2">
        {mockActivity.map((item) => (
          <div
            key={item.id}
            className={`bg-slate-800 rounded-lg p-3 border-l-4 ${typeColors[item.type]}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">{typeIcons[item.type]}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-white text-sm font-medium">{item.title}</h3>
                <p className="text-slate-400 text-xs mt-0.5 truncate">
                  {item.description}
                </p>
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {item.time}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 text-center">
        <button className="text-blue-400 text-sm hover:text-blue-300">
          Load more activity
        </button>
      </div>
    </PageContainer>
  )
}
