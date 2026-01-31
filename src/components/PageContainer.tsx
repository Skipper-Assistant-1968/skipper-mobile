import { ReactNode } from 'react'
import { useTheme } from '../context/ThemeContext'

interface PageContainerProps {
  children: ReactNode
  title?: string
}

export function PageContainer({ children, title }: PageContainerProps) {
  const { isDark } = useTheme()
  
  return (
    <div className={`min-h-screen pt-14 pb-20 px-4 transition-colors ${
      isDark ? 'bg-slate-900' : 'bg-slate-50'
    }`}>
      {title && (
        <h1 className={`text-2xl font-bold mb-4 pt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h1>
      )}
      {children}
    </div>
  )
}
