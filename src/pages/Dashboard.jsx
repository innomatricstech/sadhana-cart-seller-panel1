// Dashboard.jsx
import React, { useState, useEffect } from 'react'
import {
  Package, ShoppingCart, Menu, X, Plus, Upload, LogOut, User, Bot, CheckCircle, AlertCircle
} from 'lucide-react'
import AddProduct from './AddProduct'
import SellerProducts from './SellerProducts'
import OrderDetails from './OrderDetails'
import JsonBulkUpload from './JsonBulkUpload'
import PythonAutomation from './PythonAutomation'
import { useSeller } from '../context/SellerContext'
import { auth, db } from '../config/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

const Dashboard = () => {
  const { seller } = useSeller()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('profile')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      if (!user) {
        navigate('/seller/login')
        return
      }

      const sellerRef = doc(db, 'sellers', user.uid)
      const unsubscribeSeller = onSnapshot(sellerRef, (docSnap) => {
        if (docSnap.exists()) {
          const sellerData = docSnap.data()
          if (sellerData?.status === 'blocked') {
            alert('Your account has been blocked by the admin.')
            signOut(auth).then(() => navigate('/seller/login'))
          }
        }
      }, (err) => {
        console.error('seller snapshot error', err)
      })

      return () => unsubscribeSeller()
    })

    return () => {
      unsubscribeAuth()
    }
  }, [navigate])

  const sidebarItems = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'products', label: 'My Products', icon: Package },
    { id: 'orders', label: 'Order Details', icon: ShoppingCart },
    { id: 'add-product', label: 'Add Products', icon: Plus },
    { id: 'bulk-upload', label: 'JSON Bulk Upload', icon: Upload },
    { id: 'automation', label: 'Python Automation', icon: Bot }
  ]

  const handleLogout = async () => {
    await signOut(auth)
    localStorage.removeItem('user')
    localStorage.removeItem('seller')
    navigate('/seller/login')
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <SellerProfile currentUser={currentUser} collectionName="sellers" onLogout={handleLogout} />
      case 'products':
        return <SellerProducts />
      case 'orders':
        return <OrderDetails />
      case 'add-product':
        return <AddProduct />
      case 'bulk-upload':
        return <JsonBulkUpload />
      case 'automation':
        return <PythonAutomation />
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 relative">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${sidebarOpen ? 'w-64' : 'lg:w-16'} fixed lg:relative z-50 bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl transition-all duration-300 flex flex-col border-r border-slate-700 h-full`}
      >
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {(sidebarOpen || window.innerWidth >= 1024) && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white">Seller Store</h2>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md hover:bg-slate-700 transition-colors text-white lg:hidden"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id)
                  if (window.innerWidth < 1024) setSidebarOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                  activeSection === item.id
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform -translate-y-0.5 scale-[1.01]'
                    : 'text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                {(sidebarOpen || window.innerWidth >= 1024) && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400 hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {(sidebarOpen || window.innerWidth >= 1024) && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:ml-0">
        <header className="bg-gradient-to-r from-slate-800 to-slate-900 shadow-sm border-b border-slate-700 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-slate-700 text-white"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-semibold text-white">
                  {sidebarItems.find((item) => item.id === activeSection)?.label || 'Dashboard'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Welcome back, {seller?.name || seller?.email || 'Seller'}!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-300 hidden sm:block">Signed in as</div>
              <div className="flex items-center gap-3 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                  {getInitials(seller?.name || currentUser?.displayName || currentUser?.email)}
                </div>
                <div className="text-sm text-white">
                  {seller?.name || currentUser?.displayName || currentUser?.email || 'Seller'}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="p-6 bg-gray-900 min-h-[calc(100vh-80px)]">
          {renderContent()}
        </section>
      </main>
    </div>
  )
}

export default Dashboard

/* ---------------- SellerProfile (in-file) ---------------- */
function SellerProfile({ currentUser, collectionName = 'sellers', onLogout }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null) // {type: 'success'|'error', text}
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    storeName: '',
    businessAddress: '',
    gstNumber: '',
    sellerId: '',
  })

  useEffect(() => {
    if (!currentUser || !currentUser.uid) {
      setLoading(false)
      return
    }

    const docRef = doc(db, collectionName, currentUser.uid)
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setProfile({
          fullName: data.name || data.fullName || '',
          email: data.email || currentUser.email || '',
          phone: data.phone || data.phoneNumber || '',
          storeName: data.storeName || data.shopName || '',
          businessAddress: data.businessAddress || data.address || '',
          gstNumber: data.gstNumber || '',
          sellerId: snap.id,
        })
      } else {
        setProfile((p) => ({
          ...p,
          email: currentUser.email || p.email,
          sellerId: currentUser.uid
        }))
      }
      setLoading(false)
    }, (err) => {
      console.error('profile snapshot error', err)
      setLoading(false)
      setMsg({ type: 'error', text: 'Failed to load profile.' })
    })

    return () => unsubscribe()
  }, [currentUser, collectionName])

  const handleChange = (e) => {
    const { name, value } = e.target
    setProfile((p) => ({ ...p, [name]: value }))
  }

  const validate = () => {
    if (!profile.fullName.trim()) return 'Full name is required.'
    if (!profile.email.trim() || !/^\S+@\S+\.\S+$/.test(profile.email)) return 'Valid email is required.'
    if (profile.phone && !/^[\d+\-()\s]{6,20}$/.test(profile.phone)) return 'Enter a valid phone number.'
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      setMsg({ type: 'error', text: validationError })
      return
    }
    if (!currentUser || !currentUser.uid) {
      setMsg({ type: 'error', text: 'No authenticated user.' })
      return
    }
    setSaving(true)
    setMsg(null)
    const docRef = doc(db, collectionName, currentUser.uid)
    const payload = {
      name: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      storeName: profile.storeName,
      businessAddress: profile.businessAddress,
      gstNumber: profile.gstNumber,
      lastUpdated: serverTimestamp(),
    }

    try {
      await updateDoc(docRef, payload).catch(async () => {
        await setDoc(docRef, { ...payload, createdAt: serverTimestamp() })
      })
      setMsg({ type: 'success', text: 'Profile updated successfully.' })
    } catch (err) {
      console.error('Failed to save profile:', err)
      setMsg({ type: 'error', text: 'Failed to save profile. See console.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 3500)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-slate-300">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
            {getInitials(profile.fullName || profile.email)}
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">Seller Profile</h2>
            <p className="text-slate-300">Manage your seller account information</p>
          </div>
        </div>

        {msg && (
          <div className={`mb-4 px-4 py-2 rounded-md flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-900/40 text-green-200' : 'bg-red-900/40 text-red-200'}`}>
            {msg.type === 'success' ? <CheckCircle /> : <AlertCircle />}
            <div className="text-sm">{msg.text}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <Field label="Full Name">
              <input name="fullName" value={profile.fullName} onChange={handleChange} placeholder="Enter your full name"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>

            <Field label="Email">
              <input name="email" value={profile.email} onChange={handleChange} placeholder="Enter your email"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>

            <Field label="Phone Number (optional)">
              <input name="phone" value={profile.phone} onChange={handleChange} placeholder="Enter your phone number"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>

            <Field label="Seller ID">
              <input value={profile.sellerId || (currentUser && currentUser.uid) || ''} readOnly
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-300 text-sm" />
            </Field>
          </div>

          <div className="space-y-4">
            <Field label="Store Name">
              <input name="storeName" value={profile.storeName} onChange={handleChange} placeholder="Enter your store name"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>

            <Field label="Business Address">
              <textarea name="businessAddress" value={profile.businessAddress} onChange={handleChange} placeholder="Enter your business address"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>

            <Field label="GST Number">
              <input name="gstNumber" value={profile.gstNumber} onChange={handleChange} placeholder="Enter your GST number"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => {
              if (confirm('Discard local changes?')) {
                // onSnapshot will re-sync if db different
                setMsg(null)
              }
            }}
            className="px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-600 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md shadow-md disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Helper components & functions ---------------- */
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-2">{label}</label>
      {children}
    </div>
  )
}

function getInitials(text) {
  if (!text) return 'S'
  const parts = String(text).split(/[\s@.]+/).filter(Boolean)
  if (parts.length === 0) return 'S'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
