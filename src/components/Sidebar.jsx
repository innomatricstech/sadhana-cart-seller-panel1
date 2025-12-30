import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Package,
  ShoppingCart,
  Plus,
  Bot,
  Upload,
  LogOut,
  User
} from 'lucide-react'

const Sidebar = ({ user, onLogout }) => {
  const location = useLocation()

  const menuItems = [
    { path: '/profile', icon: User, label: 'Profile' },
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/documentation', icon: FileText, label: 'Seller Documentation' },
    { path: '/products', icon: Package, label: 'My Products' },
    { path: '/orders', icon: ShoppingCart, label: 'Order Details' },
    { path: '/add-product', icon: Plus, label: 'Add Product' },
    { path: '/automation', icon: Bot, label: 'Python Automation' },
    { path: '/bulk-upload', icon: Upload, label: 'JSON Bulk Upload' }
  ]

  return (
    <div className="w-64 h-screen bg-gradient-to-b from-gray-800 to-gray-900 shadow-2xl relative">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">BaapStore</h1>
      </div>

      {/* Navigation */}
      <nav className="mt-6 pb-40 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-6 py-3 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="absolute bottom-0 w-64 border-t border-gray-700">
        {/* User Profile Section */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'Seller'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email || 'seller@namah.com'}</p>
              <p className="text-xs text-blue-400 truncate">ID: {user?.sellerId || 'N/A'}</p>
            </div>
          </div>
        </div>
        
        {/* Logout Button */}
        <div className="p-4">
          <button
            onClick={onLogout}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/20 rounded-lg transition-colors duration-200"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default Sidebar