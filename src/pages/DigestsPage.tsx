import { PageContainer } from '../components/PageContainer'

interface Digest {
  id: string
  title: string
  summary: string
  source: string
  time: string
  unread: boolean
}

const mockDigests: Digest[] = [
  {
    id: '1',
    title: 'Morning Briefing',
    summary: 'You have 3 unread emails, 2 calendar events today, and the weather looks clear.',
    source: 'Daily Summary',
    time: '8:00 AM',
    unread: true,
  },
  {
    id: '2',
    title: 'Project Update',
    summary: 'Skipper Mobile PWA setup is in progress. Foundation components being built.',
    source: 'GitHub',
    time: 'Yesterday',
    unread: false,
  },
  {
    id: '3',
    title: 'Weekly Recap',
    summary: 'You completed 12 tasks this week. 3 are still pending review.',
    source: 'Weekly Summary',
    time: 'Jan 27',
    unread: false,
  },
]

export function DigestsPage() {
  return (
    <PageContainer title="Digests">
      <div className="space-y-3">
        {mockDigests.map((digest) => (
          <div
            key={digest.id}
            className={`bg-slate-800 rounded-xl p-4 border transition-colors ${
              digest.unread ? 'border-blue-500/50' : 'border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {digest.unread && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                  <h3 className="text-white font-medium">{digest.title}</h3>
                </div>
                <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                  {digest.summary}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <span>{digest.source}</span>
                  <span>•</span>
                  <span>{digest.time}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 text-center text-slate-500 text-sm">
        <p>Pull down to refresh</p>
      </div>
    </PageContainer>
  )
}
