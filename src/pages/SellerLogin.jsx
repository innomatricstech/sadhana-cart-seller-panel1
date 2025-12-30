import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle, Send } from 'lucide-react'
import { useSellerContext } from '../context/SellerContext'
import { auth, db } from '../config/firebase'
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth'
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore'

const SellerLogin = () => {
  const navigate = useNavigate()
  const { dispatch } = useSellerContext()

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')

  const handleInputChange = (e) => {
    const { name, value } = e.target

    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // sync forgot email only when forgot UI isn't open to avoid surprise edits
    if (!forgotOpen && name === 'email') {
      setForgotEmail(value)
    }

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }

    if (loginError) setLoginError('')
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email'
      }
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // helper: find seller doc by either doc id = uid OR by field uid
  const findSellerDocByAuthUid = async (authUid) => {
    // 1) try doc with id = authUid
    try {
      const directRef = doc(db, 'sellers', authUid)
      const directSnap = await getDoc(directRef)
      if (directSnap.exists()) {
        return { id: directSnap.id, data: directSnap.data() }
      }
    } catch (err) {
      console.warn('Direct seller doc lookup failed:', err)
    }

    // 2) fallback: query sellers where field 'uid' equals authUid
    try {
      const sellersCol = collection(db, 'sellers')
      const q = query(sellersCol, where('uid', '==', authUid))
      const qSnap = await getDocs(q)
      if (!qSnap.empty) {
        // take first match
        const firstDoc = qSnap.docs[0]
        return { id: firstDoc.id, data: firstDoc.data() }
      }
    } catch (err) {
      console.warn('Querying seller by uid field failed:', err)
    }

    // not found
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setLoginError('')

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      )

      const user = userCredential.user
      const authUid = user.uid

      // Find seller doc and sellerId (supports both doc id === uid and custom doc id)
      const sellerDocResult = await findSellerDocByAuthUid(authUid)

      if (!sellerDocResult) {
        // No seller document found for this auth user
        await signOut(auth)
        setLoginError('Seller account not found. Please register first.')
        return
      }

      const sellerId = sellerDocResult.id
      const sellerData = sellerDocResult.data

      // ✅ Check if seller is BLOCKED
      if (sellerData.status === 'blocked') {
        await signOut(auth)
        setLoginError('Your account has been blocked. Please contact support.')
        return
      }

      // ✅ Check if seller is REJECTED
      if (sellerData.status === 'rejected') {
        await signOut(auth)
        setLoginError('Your seller account has been rejected.')
        return
      }

      // ✅ Optional: prevent login if still pending approval
      if (sellerData.status === 'pending') {
        await signOut(auth)
        setLoginError('Your seller account is still under review.')
        return
      }

      // ✅ Save seller info in global context (use the found sellerId)
      dispatch({
        type: 'LOGIN_SELLER',
        payload: {
          id: sellerId,
          authUid,
          email: formData.email,
          loginTime: new Date().toISOString(),
          ...sellerData
        }
      })

      console.log('✅ Seller logged in:', sellerId)

      // Route control based on document upload status
      if (!sellerData.documentsUploaded) {
        navigate('/seller/documents')
        return
      }

      // Success — go to dashboard
      navigate('/dashboard')
    } catch (error) {
      console.error('Login error:', error)

      let errorMessage = 'Invalid email or password.'

      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.'
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.'
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.'
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.'
      }

      setLoginError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // --- Forgot password handlers ---
  const openForgot = () => {
    setForgotError('')
    setForgotSuccess('')
    setForgotOpen(true)
    // prefill with current email value
    setForgotEmail(formData.email || '')
  }

  const closeForgot = () => {
    setForgotOpen(false)
    setForgotEmail('')
    setForgotError('')
    setForgotSuccess('')
  }

  const handleForgotChange = (e) => {
    setForgotEmail(e.target.value)
    if (forgotError) setForgotError('')
    if (forgotSuccess) setForgotSuccess('')
  }

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(String(email).toLowerCase())
  }

  const handleSendReset = async () => {
    setForgotError('')
    setForgotSuccess('')

    const emailToSend = (forgotEmail || '').trim()
    if (!emailToSend) {
      setForgotError('Please enter your email address.')
      return
    }
    if (!validateEmail(emailToSend)) {
      setForgotError('Please enter a valid email address.')
      return
    }

    setForgotLoading(true)
    try {
      await sendPasswordResetEmail(auth, emailToSend)
      setForgotSuccess('Password reset email sent. Check your inbox (and spam).')
      // optionally clear main email field so user sees feedback
      setFormData(prev => ({ ...prev, email: emailToSend }))
      // automatically close after a short delay
      setTimeout(() => {
        closeForgot()
      }, 3500)
    } catch (err) {
      console.error('Error sending password reset email:', err)
      // map common firebase auth errors
      if (err.code === 'auth/user-not-found') {
        setForgotError('No account found with this email.')
      } else if (err.code === 'auth/invalid-email') {
        setForgotError('Invalid email address.')
      } else {
        setForgotError('Failed to send reset email. Try again later.')
      }
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-800 py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-gray-700">

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white">Seller Login</h1>
            <p className="text-gray-300 mt-2">Sign in to your seller account</p>
          </div>

          {loginError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{loginError}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder="Enter email"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-10 py-2 border rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 ${
                    errors.password ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input id="remember-me" type="checkbox" className="h-4 w-4" />
                <label htmlFor="remember-me" className="ml-2 text-sm text-gray-300">
                  Remember me
                </label>
              </div>

              <button
                type="button"
                onClick={openForgot}
                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 flex items-center justify-center disabled:opacity-50"
            >
              {isLoading ? (
                <div className="animate-spin h-5 w-5 rounded-full border-b-2 border-white" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-300">
              New here?{' '}
              <button
                className="text-blue-400 hover:text-blue-300"
                onClick={() => navigate('/seller/register')}
              >
                Create Seller Account
              </button>
            </p>
          </div>

          {/* Forgot password inline panel */}
          {forgotOpen && (
            <div className="mt-6 bg-gray-900 border border-gray-700 rounded-md p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white flex items-center">
                    <Send className="h-4 w-4 mr-2 text-gray-300" />
                    Reset password
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Enter your email to receive a password reset link.
                  </p>
                </div>
                <div>
                  <button
                    onClick={closeForgot}
                    className="text-gray-400 hover:text-gray-200 text-sm font-medium"
                    aria-label="Close reset panel"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-xs text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={handleForgotChange}
                  className={`w-full px-3 py-2 border rounded-md bg-gray-800 text-white focus:ring-2 focus:ring-blue-500 ${
                    forgotError ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder="your@email.com"
                />
                {forgotError && <p className="text-red-500 text-xs mt-1">{forgotError}</p>}
                {forgotSuccess && (
                  <div className="mt-2 flex items-center text-green-400 text-sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    <span>{forgotSuccess}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center space-x-2">
                <button
                  onClick={handleSendReset}
                  disabled={forgotLoading}
                  className="bg-blue-600 text-white px-3 py-1 rounded-md flex items-center hover:bg-blue-700 disabled:opacity-50"
                >
                  {forgotLoading ? (
                    <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" />
                  ) : (
                    <>
                      Send reset email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
                <button
                  onClick={closeForgot}
                  className="text-sm text-gray-300 hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default SellerLogin
