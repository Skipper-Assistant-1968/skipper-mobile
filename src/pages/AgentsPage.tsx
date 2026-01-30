import { PageContainer } from '../components/PageContainer'

interface Agent {
  id: string
  name: string
  status: 'active' | 'idle' | 'offline'
  lastActive: string
  task?: string
}

const mockAgents: Agent[] = [
  {
    id: 'main',
    name: 'Main Agent',
    status: 'active',
    lastActive: 'Now',
    task: 'Setting up PWA foundation',
  },
  {
    id: 'research',
    name: 'Research Agent',
    status: 'idle',
    lastActive: '5 min ago',
  },
  {
    id: 'coder',
    name: 'Code Agent',
    status: 'idle',
    lastActive: '12 min ago',
  },
  {
    id: 'monitor',
    name: 'Monitor Agent',
    status: 'offline',
    lastActive: '2 hours ago',
  },
]

const statusConfig = {
  active: { color: 'bg-green-500', text: 'Active', pulse: true },
  idle: { color: 'bg-yellow-500', text: 'Idle', pulse: false },
  offline: { color: 'bg-slate-500', text: 'Offline', pulse: false },
}

export function AgentsPage() {
  return (
    <PageContainer title="Agents">
      <div className="space-y-3">
        {mockAgents.map((agent) => {
          const config = statusConfig[agent.status]
          return (
            <div
              key={agent.id}
              className="bg-slate-800 rounded-xl p-4 border border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-xl">
                    🤖
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-white font-medium">{agent.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className={config.color.replace('bg-', 'text-').replace('-500', '-400')}>
                      {config.text}
                    </span>
                    <span>•</span>
                    <span>{agent.lastActive}</span>
                  </div>
                  {agent.task && (
                    <p className="text-sm text-slate-300 mt-1 truncate">
                      📋 {agent.task}
                    </p>
                  )}
                </div>
                
                <button className="text-slate-400 hover:text-white p-2">
                  →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </PageContainer>
  )
}
