// SellerProducts.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // <--- ADDED IMPORT
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import './SellerProducts.css';
import {
  Search,
  Grid,
  Tag,
  Plus,
  AlertTriangle,
  RefreshCw,
  Edit,
  Eye,
  X
} from 'lucide-react';

const SellerProducts = React.memo(() => {
  const [products, setProducts] = useState([]);
  const [sellerDoc, setSellerDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sellerUid, setSellerUid] = useState(null);
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  const navigate = useNavigate(); // <--- ADDED: Initialize navigate

  const productIdFromPath = useMemo(() => {
    try {
      const match = window.location.pathname.match(/\/products\/([^/]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }, []);

  // FIX: Corrected onAuthStateChanged cleanup function to prevent 'unsubscribe is not a function' error
  useEffect(() => {
    // onAuthStateChanged returns the unsubscribe function directly.
    const unsubscribe = onAuthStateChanged(auth, user => {
      setSellerUid(user ? user.uid : null);
    });
    // Return the unsubscribe function for cleanup
    return unsubscribe;
  }, []);

  const mergeUniqueById = (arr1 = [], arr2 = []) => {
    const map = new Map();
    arr1.concat(arr2).forEach(item => {
      if (!item) return;
      map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  const buildOwnerIdSet = useCallback((sellerData, uid) => {
    const s = new Set();
    if (uid) s.add(uid);
    if (!sellerData) return s;
    if (sellerData.id) s.add(sellerData.id);
    if (sellerData.sellerid) s.add(sellerData.sellerid);
    if (sellerData.sellerID) s.add(sellerData.sellerID);
    if (sellerData.sellerId) s.add(sellerData.sellerId);
    return s;
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProducts([]);

    let sellerData = null;
    try {
      if (sellerUid) {
        const sellerRef = doc(db, 'sellers', sellerUid);
        const sSnap = await getDoc(sellerRef);
        if (sSnap.exists()) {
          sellerData = { id: sSnap.id, ...sSnap.data() };
          setSellerDoc(sellerData);
        } else {
          setSellerDoc(null);
        }
      } else {
        setSellerDoc(null);
      }
    } catch (err) {
      console.warn('Failed fetching seller doc:', err);
      setSellerDoc(null);
    }

    const ownerIdSet = buildOwnerIdSet(sellerData, sellerUid);

    if (productIdFromPath) {
      try {
        const pRef = doc(db, 'products', productIdFromPath);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const p = { id: pSnap.id, ...pSnap.data() };
          const ownerMatches = (
            (p.sellerid && ownerIdSet.has(p.sellerid)) ||
            (p.sellerID && ownerIdSet.has(p.sellerID)) ||
            (p.sellerId && ownerIdSet.has(p.sellerId)) ||
            ownerIdSet.has(p.seller) ||
            ownerIdSet.has(p.owner)
          );
          if (ownerMatches || ownerIdSet.size === 0) {
            setProducts([p]);
          } else {
            setProducts([]);
            setError('You are not authorized to view this product.');
          }
        } else {
          setProducts([]);
          setError('Product not found.');
        }
      } catch (err) {
        console.error('Error fetching single product:', err);
        setError('Failed to fetch product.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      if (!sellerUid && ownerIdSet.size === 0) {
        setProducts([]);
        setLoading(false);
        setError('No seller signed in.');
        return;
      }

      let resultsA = [];
      try {
        const qA = query(
          collection(db, 'products'),
          where('sellerid', '==', sellerUid || '')
        );
        const snapA = await getDocs(qA);
        resultsA = snapA.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn('Query sellerid failed:', err);
      }

      let resultsB = [];
      try {
        const qB = query(
          collection(db, 'products'),
          where('sellerID', '==', sellerUid || '')
        );
        const snapB = await getDocs(qB);
        resultsB = snapB.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn('Query sellerID failed:', err);
      }

      let resultsC = [];
      try {
        if (sellerData && sellerData.id && sellerData.id !== sellerUid) {
          const qC1 = query(
            collection(db, 'products'),
            where('sellerid', '==', sellerData.id)
          );
          const snapC1 = await getDocs(qC1);
          resultsC = resultsC.concat(snapC1.docs.map(d => ({ id: d.id, ...d.data() })));

          const qC2 = query(
            collection(db, 'products'),
            where('sellerID', '==', sellerData.id)
          );
          const snapC2 = await getDocs(qC2);
          resultsC = resultsC.concat(snapC2.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.warn('Query using sellerData.id failed:', err);
      }

      const mergedServer = mergeUniqueById(resultsA, resultsB);
      const mergedAllServer = mergeUniqueById(mergedServer, resultsC);

      if (mergedAllServer.length > 0) {
        const filtered = mergedAllServer.filter(p => {
          const candidates = [p.sellerid, p.sellerID, p.sellerId, p.seller, p.owner];
          return candidates.some(c => c && ownerIdSet.has(c));
        });
        filtered.sort((a, b) => {
          const A = (a.brand || '').toString().toLowerCase();
          const B = (b.brand || '').toString().toLowerCase();
          return A < B ? -1 : A > B ? 1 : 0;
        });
        setProducts(filtered);
        setLoading(false);
        return;
      }

      try {
        const allSnap = await getDocs(collection(db, 'products'));
        let data = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        data = data.filter(p => {
          const candidates = [p.sellerid, p.sellerID, p.sellerId, p.seller, p.owner];
          return candidates.some(c => c && ownerIdSet.has(c));
        });
        data.sort((a, b) => {
          const A = (a.brand || '').toString().toLowerCase();
          const B = (b.brand || '').toString().toLowerCase();
          return A < B ? -1 : A > B ? 1 : 0;
        });
        setProducts(data);
        setLoading(false);
        return;
      } catch (fallbackErr) {
        console.error('Fallback fetch failed:', fallbackErr);
        setError('Failed fetching products (fallback).');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to fetch products. Check console for details.');
      setLoading(false);
    }
  }, [sellerUid, productIdFromPath, buildOwnerIdSet]);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerUid, productIdFromPath]);

  const handleUpdateProductDetails = useCallback(async (productId, updatedFields) => {
    setIsUpdatingDetails(true);
    setUpdateError(null);
    try {
      const productRef = doc(db, 'products', productId);

      // Map fields to DB names and ensure numbers
      const payload = {
        ...updatedFields,
        price: Number(updatedFields.price) || 0,
        offerPrice: Number(updatedFields.offerPrice) || 0,
        // accept both names: stockQuantity or stock
        stock: Number(updatedFields.stockQuantity ?? updatedFields.stock) || 0,
        stockQuantity: Number(updatedFields.stockQuantity ?? updatedFields.stock) || 0,
        // ensure subCategory field is written in DB consistently
        subCategory: updatedFields.subCategory ?? updatedFields.subcategory ?? updatedFields.subCategory,
        updatedAt: new Date().toISOString(),
      };

      // Remove undefined keys to avoid Firestore complaints
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      await updateDoc(productRef, payload);

      setSelectedProduct(prev => ({ ...prev, ...payload }));
      setProducts(prevProducts => prevProducts.map(p =>
        p.id === productId ? { ...p, ...payload } : p
      ));

      alert('Product details updated successfully!');
    } catch (err) {
      console.error('Failed to update product details:', err);
      setUpdateError('Failed to update product details. Check console.');
      throw new Error('Update failed');
    } finally {
      setIsUpdatingDetails(false);
    }
  }, []);

  const filteredProducts = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return products.filter(product => {
      const brandMatch = product.brand ? product.brand.toLowerCase().includes(searchLower) : false;
      const descriptionMatch = product.description ? product.description.toLowerCase().includes(searchLower) : false;
      const skuMatch = product.basesku || product.sku ? (product.basesku || product.sku).toLowerCase().includes(searchLower) : false;
      const productNameMatch = product.name ? product.name.toLowerCase().includes(searchLower) : false;
      const searchKeywordsMatch = product.searchKeywords ? (product.searchKeywords.join(' ').toLowerCase()).includes(searchLower) : false;

      const matchesSearch = brandMatch || descriptionMatch || skuMatch || productNameMatch || searchKeywordsMatch;
      const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, filterCategory]);

  const categories = useMemo(() => (['all', ...new Set(products.map(p => p.category).filter(Boolean))]), [products]);

  const handleViewDetails = useCallback((product) => {
    setSelectedProduct(product);
    setUpdateError(null);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedProduct(null);
    setUpdateError(null);
    setIsUpdatingDetails(false);
  }, []);

  const handleTouchStart = useCallback((e) => { e.currentTarget.style.transform = 'scale(0.98)'; }, []);
  const handleTouchEnd = useCallback((e) => { e.currentTarget.style.transform = 'scale(1)'; }, []);

  if (loading) {
    return (
      <div className="seller-products dark-theme">
        <div className="dashboard-header animated-header">
          <div className="header-content">
            <div className="title-section"><h1>Product Inventory 📦</h1><p>Manage your product catalog</p></div>
            <div className="stats-section"><div className="stat-item skeleton-stat"></div><div className="stat-item skeleton-stat"></div></div>
          </div>
          <div className="filters-section skeleton-filters">
            <div className="search-box-skeleton"></div>
            <div className="category-filter-skeleton"></div>
            <div className="add-product-btn-skeleton"></div>
          </div>
        </div>

        <div className="products-grid loading-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="product-card skeleton">
              <div className="product-icon-skeleton"></div>
              <div className="card-content-skeleton">
                <div className="skeleton-text title"></div>
                <div className="skeleton-text short"></div>
                <div className="skeleton-text medium"></div>
                <div className="skeleton-buttons"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="seller-products dark-theme">
      <div className="dashboard-header animated-header">
        <div className="header-content">
          <div className="title-section">
            <h1>Product Inventory 📦</h1>
            <p>Manage your product catalog efficiently</p>
          </div>

          <div className="stats-section">
            <div className="stat-item">
              <span className="stat-number">{products.length}</span>
              <span className="stat-label">Total Products</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{filteredProducts.length}</span>
              <span className="stat-label">Displayed</span>
            </div>
          </div>
        </div>

        <div className="filters-section">
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Search by brand, product name, SKU, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <Tag size={18} className="filter-icon" />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="category-filter">
              {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {/* MODIFIED BUTTON TO NAVIGATE TO ADD PRODUCT PAGE */}
            <button className="add-product-btn" onClick={() => navigate('/add-products')}>
              <Plus size={18} /> Add Product
            </button>
            <button className="refresh-btn" onClick={fetchProducts} title="Refresh list"><RefreshCw size={18} /></button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner animate-slide-down">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={fetchProducts} className="retry-btn">
            <RefreshCw size={14} className="animate-spin-on-hover" /> Retry
          </button>
        </div>
      )}

      {updateError && (
        <div className="error-banner animate-slide-down" style={{ backgroundColor: '#b34747', borderColor: '#800000' }}>
          <AlertTriangle size={20} />
          <span>{updateError}</span>
        </div>
      )}

      {filteredProducts.length === 0 && !error && searchTerm ? (
        <div className="empty-state animate-fade-in">
          <Grid size={60} className="empty-icon" />
          <h3>No products found</h3>
          <p>No products match your search for "{searchTerm}".</p>
          <button className="btn-primary large-btn" onClick={() => setSearchTerm('')}>Clear Search</button>
        </div>
      ) : filteredProducts.length === 0 && !error ? (
        <div className="empty-state animate-fade-in">
          <Grid size={60} className="empty-icon" />
          <h3>No products found</h3>
          <p>Try adjusting your search filters or add a new product.</p>
          <button className="btn-primary large-btn" onClick={() => navigate('/add-products')}><Plus size={20} /> Add New Product</button>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              index={i}
              onViewDetails={handleViewDetails}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            />
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={handleCloseDetails}
          onUpdateDetails={handleUpdateProductDetails}
          isUpdatingDetails={isUpdatingDetails}
        />
      )}
    </div>
  );
});

// ProductCard and ProductDetailsModal components remain the same

const ProductCard = React.memo(({ product, index, onViewDetails, onTouchStart, onTouchEnd }) => {
  const productName = product.name || product.brand || 'Generic Product';
  const displaySku = product.basesku || product.sku || 'N/A';
  const stock = product.stockQuantity || product.stock || 0;
  const stockClass = stock > 10 ? 'in-stock' : stock > 0 ? 'low-stock' : 'out-of-stock';
  const subCategory = product.subCategory || product.subcategory || 'N/A';
  const imageUrl = product.image || product.images?.[0] || null;

  const handleCardClick = () => onViewDetails(product);

  return (
    <div
      className="product-card animate-stagger-in"
      style={{ animationDelay: `${index * 0.06}s` }}
      onTouchStart={(e) => onTouchStart(e)}
      onTouchEnd={onTouchEnd}
      onClick={handleCardClick}
    >
      <div className="product-image-wrap">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={productName}
            className="product-image"
            loading="lazy"
            onError={(e) => { e.currentTarget.src = '/fallback-image.png'; }}
          />
        ) : (
          <div className="product-image-fallback">No Image</div>
        )}
      </div>

      <div className="card-header">
        <div className="product-badge">{product.category || 'Uncategorized'}</div>
        <div className="sku-badge">SKU: {displaySku}</div>
      </div>

      <div className="card-content">
        <div className="product-info">
          <h3 className="product-title">{productName}</h3>
          <p className="product-subcategory">{subCategory}</p>
          <p className="product-color">{product.color || 'N/A'}</p>
          <p className="product-price">{product.price ? `₹${product.price}` : 'Price N/A'}</p>
          {product.offerPrice && product.offerPrice !== product.price && (
            <p className="product-offer-price">Offer: ₹{product.offerPrice} <s className="original-price">₹{product.price}</s></p>
          )}
        </div>

        <p className="product-description">{product.description ? `${product.description.substring(0, 70)}...` : 'No description available.'}</p>


        <div className="card-actions">
          <button
            className="btn-primary"
            onClick={(e) => { e.stopPropagation(); onViewDetails(product); }}
          >
            <Eye size={16} /> View Details
          </button>
        </div>
      </div>
    </div>
  );
});

const ProductDetailsModal = React.memo(({
  product,
  onClose,
  onUpdateDetails,
  isUpdatingDetails,
}) => {

  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(product);

  useEffect(() => {
    setFormData({
      ...product,
      price: Number(product.price) || 0,
      offerPrice: Number(product.offerPrice) || 0,
      stockQuantity: Number(product.stockQuantity ?? product.stock) || 0,
      subCategory: product.subCategory ?? product.subcategory ?? '',
    });
    setIsEditMode(false);
  }, [product]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      if (type === 'number') {
        return { ...prev, [name]: value === '' ? '' : Number(value) };
      }
      if (type === 'checkbox') {
        return { ...prev, [name]: checked ? 'Yes' : 'No' };
      }
      return { ...prev, [name]: value };
    });
  }, []);

  const handleSave = async () => {
    const updatedFields = {
      name: formData.name,
      brand: formData.brand,
      category: formData.category,
      subCategory: formData.subCategory ?? formData.subcategory,
      color: formData.color,
      price: formData.price,
      offerPrice: formData.offerPrice,
      stockQuantity: formData.stockQuantity,
      basesku: formData.basesku || formData.sku,
      hsnCode: formData.hsnCode,
      cashOnDelivery: formData.cashOnDelivery,
      description: formData.description,
      careinstructions: formData.careinstructions,
      image: formData.image, // allow updating image URL if needed
    };

    try {
      await onUpdateDetails(product.id, updatedFields);
      setIsEditMode(false);
    } catch (e) {
      // parent already logs
    }
  };

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget && !isUpdatingDetails) onClose();
  }, [onClose, isUpdatingDetails]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isUpdatingDetails) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isUpdatingDetails]);

  const displayData = isEditMode ? formData : product;
  const productPrice = displayData.price || 0;
  const productOfferPrice = displayData.offerPrice || 0;
  const productName = displayData.name || displayData.brand || 'Generic Product';
  const displaySku = displayData.basesku || displayData.sku || 'N/A';
  const stock = displayData.stockQuantity || displayData.stock || 0;
  const stockClass = stock > 10 ? 'in-stock' : stock > 0 ? 'low-stock' : 'out-of-stock';
  const isDisabled = isUpdatingDetails;
  const subCategory = displayData.subCategory || displayData.subcategory || 'N/A';
  const imageUrl = displayData.image || displayData.images?.[0] || null;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="product-details-modal animate-modal-in">
        <div className="modal-header">
          <h2>{productName} - {displaySku} {isEditMode && '(Editing)'}</h2>
          <button onClick={onClose} className="close-modal-btn" disabled={isDisabled}><X size={24} /></button>
        </div>

        <div className="modal-content">
          <div className="modal-image-column">
            {imageUrl ? (
              <img src={imageUrl} alt={productName} className="modal-product-image" onError={(e) => e.currentTarget.src = '/fallback-image.png'} />
            ) : (
              <div className="modal-image-fallback">No Image</div>
            )}
            <div className="modal-image-caption">Subcategory: <strong>{subCategory}</strong></div>
          </div>

          <div className="modal-details-section">
            <div className="detail-grid">
              <div className="detail-item">
                <label>Product Name:</label>
                {isEditMode ? (
                  <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span className="product-name-highlight">{productName}</span>
                )}
              </div>

              <div className="detail-item">
                <label>Brand:</label>
                {isEditMode ? (
                  <input type="text" name="brand" value={formData.brand || ''} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span>{product.brand || 'N/A'}</span>
                )}
              </div>

              <div className="detail-item">
                <label>Category:</label>
                {isEditMode ? (
                  <input type="text" name="category" value={formData.category || ''} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span>{product.category || 'N/A'}</span>
                )}
              </div>

              <div className="detail-item">
                <label>Subcategory:</label>
                {isEditMode ? (
                  <input type="text" name="subCategory" value={formData.subCategory || ''} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span>{subCategory}</span>
                )}
              </div>

              <div className="detail-item">
                <label>Color:</label>
                {isEditMode ? (
                  <input type="text" name="color" value={formData.color || ''} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span>{product.color || 'N/A'}</span>
                )}
              </div>

              <div className="detail-item">
                <label>Price:</label>
                {isEditMode ? (
                  <input type="number" name="price" value={formData.price || 0} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span className="price-highlight">{productPrice ? `₹${productPrice}` : 'N/A'}</span>
                )}
              </div>

              <div className="detail-item">
                <label>Offer Price:</label>
                {isEditMode ? (
                  <input type="number" name="offerPrice" value={formData.offerPrice || 0} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span className="offer-price">{productOfferPrice ? `₹${productOfferPrice}` : 'N/A'}</span>
                )}
              </div>

              <div className="detail-item">
                <label>Stock Quantity:</label>
                {isEditMode ? (
                  <input type="number" name="stockQuantity" value={formData.stockQuantity || 0} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span className={`stock-status ${stockClass}`}>
                    {stock}
                  </span>
                )}
              </div>

              <div className="detail-item">
                <label>SKU Code:</label>
                {isEditMode ? (
                  <input type="text" name="basesku" value={formData.basesku || formData.sku || ''} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span className="sku-code">{displaySku}</span>
                )}
              </div>

              <div className="detail-item">
                <label>HSN Code:</label>
                {isEditMode ? (
                  <input type="text" name="hsnCode" value={formData.hsnCode || ''} onChange={handleInputChange} disabled={isDisabled} className="editable-input" />
                ) : (
                  <span>{product.hsnCode || 'N/A'}</span>
                )}
              </div>

              <div className="detail-item">
                <label>Seller ID:</label>
                <span className="seller-id">{product.sellerID || product.sellerid || product.sellerId || 'N/A'}</span>
              </div>

              <div className="detail-item">
                <label>Cash on Delivery:</label>
                {isEditMode ? (
                  <select name="cashOnDelivery" value={formData.cashOnDelivery || 'No'} onChange={handleInputChange} disabled={isDisabled} className="editable-select">
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                  <span className={`cod-status ${product.cashOnDelivery === 'Yes' ? 'cod-yes' : 'cod-no'}`}>
                    {product.cashOnDelivery || 'No'}
                  </span>
                )}
              </div>

              <div className="detail-item full-width">
                <label>Product Description:</label>
                {isEditMode ? (
                  <textarea name="description" rows="4" value={formData.description || ''} onChange={handleInputChange} disabled={isDisabled} className="editable-textarea" />
                ) : (
                  <div className="full-description">
                    {product.description || 'No detailed description available.'}
                  </div>
                )}
              </div>

              {product.careinstructions && (
                <div className="detail-item full-width">
                  <label>Care Instructions:</label>
                  {isEditMode ? (
                    <textarea name="careinstructions" rows="2" value={formData.careinstructions || ''} onChange={handleInputChange} disabled={isDisabled} className="editable-textarea" />
                  ) : (
                    <span>{product.careinstructions}</span>
                  )}
                </div>
              )}

              <div className="detail-item full-width">
                <label>Product ID:</label>
                <span className="product-id">{product.id}</span>
              </div>
            </div>

            <div className="modal-actions">
              {isEditMode ? (
                <>
                  <button
                    className="btn-primary large-btn"
                    onClick={handleSave}
                    disabled={isDisabled}
                  >
                    {isUpdatingDetails ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    className="btn-outline large-btn"
                    onClick={() => { setIsEditMode(false); setFormData(product); }}
                    disabled={isDisabled}
                  >
                    <X size={18} /> Cancel Edit
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn-outline large-btn"
                    onClick={() => setIsEditMode(true)}
                    disabled={isDisabled}
                  >
                    <Edit size={18} /> Edit Product
                  </button>
                  <button className="btn-primary large-btn" disabled={isDisabled}>
                    Update Stock
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
export default SellerProducts;  