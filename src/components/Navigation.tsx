import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'

interface NavItem {
  path: string
  label: string
  icon: string
}

const navItems: NavItem[] = [
  { path: '/', label: 'Chat', icon: '💬' },
  { path: '/tasks', label: 'Tasks', icon: '✅' },
  { path: '/hot-topics', label: 'Hot', icon: '🔥' },
  { path: '/learn', label: 'Learn', icon: '📚' },
  { path: '/agents', label: 'Agents', icon: '🤖' },
]

export function Navigation() {
  const { isDark } = useTheme()
  
  return (
    <nav className={`fixed bottom-0 left-0 right-0 border-t pb-safe transition-colors ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
    }`}>
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors ${
                isActive 
                  ? 'text-blue-500' 
                  : isDark 
                    ? 'text-slate-400 hover:text-slate-300' 
                    : 'text-slate-500 hover:text-slate-700'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <motion.span 
                  className="text-xl mb-1"
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {item.icon}
                </motion.span>
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 w-12 h-0.5 bg-blue-400 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
