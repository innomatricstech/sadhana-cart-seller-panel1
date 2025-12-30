import React, { useState } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X, Eye } from 'lucide-react'
import { collection, addDoc, writeBatch, doc, getDocs, deleteDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

const JsonBulkUpload = () => {
  const [uploadedFile, setUploadedFile] = useState(null)
  const [jsonData, setJsonData] = useState('')
  const [validationResults, setValidationResults] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadHistory, setUploadHistory] = useState([])

  const sampleJsonStructure = {
    products: [
      {
        name: "Sample Product",
        description: "Product description",
        price: 99.99,
        comparePrice: 129.99,
        sku: "SAMPLE-001",
        category: "Electronics",
        subcategory: "Smartphones",
        stock: 50,
        images: ["image1.jpg", "image2.jpg"],
        specifications: [
          { "key": "Brand", "value": "Sample Brand" },
          { "key": "Model", "value": "Sample Model" }
        ],
        weight: 0.5,
        dimensions: {
          length: 10,
          width: 5,
          height: 2
        },
        
        // You can add any custom fields - they will be preserved in database
        customField1: "Any custom value",
        customField2: 123,
        customObject: {
          key1: "value1",
          key2: "value2"
        },
        customArray: ["item1", "item2", "item3"],
        manufacturer: "Sample Manufacturer",
        warranty: "1 year",
        color: "Black",
        material: "Plastic",
        origin: "Made in India"
      }
    ],
    note: "You can add ANY custom fields to your products - all data will be preserved in the database. You can also upload a direct array of products without the 'products' wrapper. Specifications can be an object or array format. Only 'name' field is required."
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file && file.type === 'application/json') {
      setUploadedFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setJsonData(event.target.result)
        validateJson(event.target.result)
      }
      reader.readAsText(file)
    } else {
      alert('Please upload a valid JSON file')
    }
  }

  const validateJson = (jsonString) => {
    try {
      const data = JSON.parse(jsonString)
      const results = {
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: 0
      }

      // Extract products from any format
      let products = []
      
      if (Array.isArray(data)) {
        // Direct array format
        products = data
      } else if (data.products && Array.isArray(data.products)) {
        // Object with products property
        products = data.products
      } else if (data.data && Array.isArray(data.data)) {
        // Object with data property
        products = data.data
      } else if (data.items && Array.isArray(data.items)) {
        // Object with items property
        products = data.items
      } else if (typeof data === 'object' && data !== null) {
        // Single product object
        products = [data]
      } else {
        results.errors.push('JSON must contain product data in any of these formats: array, {products: []}, {data: []}, {items: []}, or single object')
        results.isValid = false
        setValidationResults(results)
        return
      }

      results.recordCount = products.length
      
      products.forEach((product, index) => {
        // Very flexible validation - accept any object
        if (typeof product !== 'object' || product === null) {
          results.errors.push(`Item ${index + 1}: Must be an object`)
          return
        }
        // No field-specific validation - accept any data structure
      })

      // Always consider valid if we have at least one item
      if (products.length === 0) {
        results.errors.push('No products found in the JSON data')
        results.isValid = false
      }

      setValidationResults(results)
    } catch (error) {
      setValidationResults({
        isValid: false,
        errors: [`Invalid JSON format: ${error.message}`],
        warnings: [],
        recordCount: 0
      })
    }
  }

  const processUpload = async () => {
    if (!validationResults?.isValid) {
      alert('Please fix validation errors before processing')
      return
    }

    setIsProcessing(true)
    setMessage('')
    
    try {
      const data = JSON.parse(jsonData)
      
      // Extract products from any format (same logic as validation)
      let products = []
      if (Array.isArray(data)) {
        products = data
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products
      } else if (data.data && Array.isArray(data.data)) {
        products = data.data
      } else if (data.items && Array.isArray(data.items)) {
        products = data.items
      } else if (typeof data === 'object' && data !== null) {
        products = [data]
      }
      
      // No field processing - save data as-is
      
      let successCount = 0
      let errorCount = 0
      const errors = []
      
      // Process products in batches of 500 (Firestore batch limit)
      const batchSize = 500
      
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = writeBatch(db)
        const batchProducts = products.slice(i, i + batchSize)
        
        batchProducts.forEach((product) => {
          try {
            // Save exactly what's in the JSON file - no modifications or additions
            const productData = {
              ...product
              // Save only the data from JSON file - no extra fields
            }
            
            const docRef = doc(collection(db, 'products'))
            batch.set(docRef, productData)
            successCount++
          } catch (error) {
            errorCount++
            errors.push(`Product ${product.name || product.title || product.productName || 'Unknown'}: ${error.message}`)
          }
        })
        
        await batch.commit()
      }
      
      // Update upload history
      const newUpload = {
        id: Date.now(),
        filename: uploadedFile.name,
        uploadDate: new Date().toLocaleString(),
        status: errorCount === 0 ? 'success' : errorCount < products.length ? 'partial' : 'error',
        recordsProcessed: products.length,
        recordsSuccess: successCount,
        recordsError: errorCount
      }
      
      setUploadHistory(prev => [newUpload, ...prev])
      
      if (errorCount === 0) {
        setMessage(`Successfully uploaded ${successCount} products to Firebase!`)
      } else {
        setMessage(`Upload completed with ${successCount} successes and ${errorCount} errors. Check console for details.`)
        console.error('Upload errors:', errors)
      }
      
      // Reset form
      setUploadedFile(null)
      setJsonData('')
      setValidationResults(null)
      
    } catch (error) {
      console.error('Error during bulk upload:', error)
      setMessage('Error during upload. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }



  const deleteAllProducts = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete all products? This action cannot be undone.')
    
    if (!confirmDelete) return
    
    setIsProcessing(true)
    setMessage('')
    
    try {
      const productsCollection = collection(db, 'products')
      const snapshot = await getDocs(productsCollection)
      
      if (snapshot.empty) {
        setMessage('No products found to delete.')
        setIsProcessing(false)
        return
      }
      
      const batch = writeBatch(db)
      let deleteCount = 0
      
      snapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref)
        deleteCount++
      })
      
      await batch.commit()
      
      setMessage(`Successfully deleted ${deleteCount} products.`)
      
      // Clear upload history from localStorage as well
      localStorage.removeItem('uploadHistory')
      
      // Refresh stats after deletion
      fetchStats()
      
    } catch (error) {
      console.error('Error deleting products:', error)
      setMessage('Error occurred while deleting products. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">JSON Bulk Upload</h1>
        <p className="text-gray-400 text-sm sm:text-base">Upload products in bulk using JSON files</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Total Uploads</p>
              <p className="text-xl sm:text-3xl font-bold text-white">{uploadHistory.length}</p>
            </div>
            <div className="text-blue-500">
              <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Successful</p>
              <p className="text-xl sm:text-3xl font-bold text-white">{uploadHistory.filter(upload => upload.status === 'success').length}</p>
            </div>
            <div className="text-green-500">
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Failed</p>
              <p className="text-xl sm:text-3xl font-bold text-white">{uploadHistory.filter(upload => upload.status === 'error').length}</p>
            </div>
            <div className="text-red-500">
              <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Last Upload</p>
              <p className="text-sm sm:text-lg font-bold text-white">{uploadHistory.length > 0 ? uploadHistory[0].uploadDate : 'No uploads yet'}</p>
            </div>
            <div className="text-purple-500">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Upload Instructions */}
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Upload JSON File</h3>
        <p className="text-gray-400 mb-4 text-sm sm:text-base">Select any JSON file containing product data. Supports any format - arrays, objects, single products, and flexible field names.</p>
        
        
        
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 sm:p-8 text-center">
          <Upload className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-2 text-sm sm:text-base">Drag and drop your JSON file here, or click to browse</p>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
            id="json-upload"
          />
          <label
            htmlFor="json-upload"
            className="bg-blue-600 text-white px-4 py-2 sm:px-6 sm:py-2 rounded-lg hover:bg-blue-700 cursor-pointer inline-block text-sm sm:text-base"
          >
            Choose File
          </label>
        </div>
      </div>

  

      {/* File Upload Section */}
      {uploadedFile && (
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-4 break-all">Uploaded File: {uploadedFile.name}</h3>
          
          {validationResults && (
            <div className="mb-4">
              <div className={`p-3 sm:p-4 rounded-lg ${
                validationResults.isValid ? 'bg-green-900 border border-green-600' : 'bg-red-900 border border-red-600'
              }`}>
                <h4 className="font-semibold text-white mb-2 text-sm sm:text-base">
                  {validationResults.isValid ? 'Validation Passed' : 'Validation Failed'}
                </h4>
                <p className="text-gray-300 mb-2 text-sm sm:text-base">Records found: {validationResults.recordCount}</p>
                
                {validationResults.errors.length > 0 && (
                  <div className="mb-2">
                    <p className="text-red-400 font-medium">Errors:</p>
                    <ul className="text-red-300 text-sm list-disc list-inside">
                      {validationResults.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {validationResults.warnings.length > 0 && (
                  <div>
                    <p className="text-yellow-400 font-medium">Warnings:</p>
                    <ul className="text-yellow-300 text-sm list-disc list-inside">
                      {validationResults.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button 
              onClick={processUpload}
              disabled={!validationResults?.isValid || isProcessing}
              className="bg-green-600 text-white px-4 py-3 sm:px-6 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Process Upload'}
            </button>
            

          </div>
          
          {message && (
            <div className="mt-4 p-3 sm:p-4 bg-blue-900 border border-blue-600 rounded-lg">
              <p className="text-blue-300 text-sm sm:text-base">{message}</p>
            </div>
          )}
        </div>
      )}

      {/* Upload History */}
      <div className="bg-gray-800 rounded-lg">
        <div className="p-4 sm:p-6 border-b border-gray-700">
          <h2 className="text-base sm:text-lg font-semibold text-white">Upload History</h2>
          <p className="text-gray-400 text-xs sm:text-sm">Record of previous uploads</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">DATE & TIME</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">STATUS</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">TOTAL PRODUCTS</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">FILE NAME</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {uploadHistory.map((upload) => (
                <tr key={upload.id} className="hover:bg-gray-700">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-white">{upload.uploadDate}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Success
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-white">{upload.recordsProcessed}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-white truncate max-w-[150px]">{upload.filename}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default JsonBulkUpload