import { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  title?: string
}

export function PageContainer({ children, title }: PageContainerProps) {
  return (
    <div className="min-h-screen bg-slate-900 pt-14 pb-20 px-4">
      {title && (
        <h1 className="text-2xl font-bold text-white mb-4 pt-2">{title}</h1>
      )}
      {children}
    </div>
  )
}
