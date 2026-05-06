import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Disc, Settings, ShieldAlert, Star } from 'lucide-react';
import axios from 'axios';
import './index.css';

// Base API URL
const API_URL = 'http://localhost:5000/api';

// Mock Users
const USERS = [
  { id: 1, name: 'Buyer', role: 'buyer' },
  { id: 2, name: 'Seller', role: 'seller' },
  { id: 3, name: 'Admin', role: 'admin' }
];

function App() {
  const [currentUser, setCurrentUser] = useState(USERS[0]);
  const [userProfile, setUserProfile] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [purchasedSellers, setPurchasedSellers] = useState([]);
  const [users, setUsers] = useState(USERS);
  const [registerOpen, setRegisterOpen] = useState(false);

  const handleNewUser = (newUser) => {
    const role = newUser.sell_flag ? 'seller' : 'buyer';
    const userEntry = { id: newUser.userid, name: newUser.name, role };
    setUsers(prev => [...prev, userEntry]);
    setCurrentUser(userEntry);
    setRegisterOpen(false);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/users/${currentUser.id}`);
        setUserProfile(res.data);
      } catch (err) {
        console.error('Failed to fetch user profile', err);
        setUserProfile(null);
      }
    };
    fetchProfile();
  }, [currentUser]);

  const isRestricted = userProfile?.access === 'restricted';

  const handleCheckoutComplete = (items) => {
    const uniqueSellersMap = {};
    items.forEach(item => {
      if (item.seller_id && item.sellername) {
        uniqueSellersMap[item.seller_id] = item.sellername;
      }
    });
    const sellers = Object.keys(uniqueSellersMap).map(id => ({
      seller_id: id,
      sellername: uniqueSellersMap[id]
    }));
    setPurchasedSellers(sellers);
    setRatingModalOpen(true);
  };

  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-links" style={{ alignItems: 'center' }}>
            <Disc className="gradient-text" size={32} />
            <span className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 'bold', marginRight: '2rem' }}>SpinSync</span>
            <Link to="/" className="nav-link">Marketplace</Link>
            {currentUser.role === 'buyer' && <Link to="/purchases" className="nav-link">My Purchases</Link>}
            {currentUser.role === 'seller' && <Link to="/seller" className="nav-link">Seller Dashboard</Link>}
            {currentUser.role === 'admin' && <Link to="/admin" className="nav-link">Admin Panel</Link>}
          </div>

          <div className="mock-auth">
            <span style={{ color: 'var(--text-muted)' }}>Simulate Login:</span>
            <select
              value={currentUser.id}
              onChange={(e) => setCurrentUser(users.find(u => u.id === parseInt(e.target.value)))}
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <button className="btn-success" onClick={() => setRegisterOpen(true)} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              + New Account
            </button>
            <button className="btn-secondary" onClick={() => setCartOpen(!cartOpen)}>
              <ShoppingCart size={20} />
            </button>
          </div>
        </nav>

        {cartOpen && <CartDrawer userId={currentUser.id} isRestricted={isRestricted} onClose={() => setCartOpen(false)} onCheckoutComplete={handleCheckoutComplete} />}
        {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} onSuccess={handleNewUser} />}
        {ratingModalOpen && (
          <RatingModal
            sellers={purchasedSellers}
            raterId={currentUser.id}
            onClose={() => setRatingModalOpen(false)}
          />
        )}

        <main className="container animate-fade-in">
          <Routes>
            <Route path="/" element={<Marketplace currentUser={currentUser} isRestricted={isRestricted} />} />
            <Route path="/purchases" element={<BuyerInventory currentUser={currentUser} />} />
            <Route path="/seller" element={<SellerDashboard currentUser={currentUser} isRestricted={isRestricted} />} />
            <Route path="/admin" element={<AdminPanel currentUser={currentUser} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function Marketplace({ currentUser, isRestricted }) {
  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');

  useEffect(() => {
    fetchListings();
  }, [search, sort]);

  const fetchListings = async () => {
    try {
      let url = `${API_URL}/listings?`;
      if (search) url += `search=${search}&`;
      if (sort) url += `sort=${sort}`;
      const res = await axios.get(url);
      setListings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = async (discId) => {
    try {
      await axios.post(`${API_URL}/cart`, { userId: currentUser.id, discId });
      alert('Added to cart!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add to cart');
    }
  };

  const promotedListings = listings.filter(l => l.is_promoted && l.promote_approved);
  const regularListings = listings.filter(l => !(l.is_promoted && l.promote_approved));

  const ListingCard = ({ listing }) => (
    <div className="glass listing-card" style={{ padding: '1.5rem', border: listing.is_promoted && listing.promote_approved ? '1px solid var(--primary)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3>{listing.title}</h3>
        <span className="gradient-text" style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>${listing.price}</span>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
        Format: {listing.format || 'Unknown'} | Condition: {listing.condition}
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Seller: {listing.sellername}</p>
      {isRestricted ? (
        <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '1.5rem', textAlign: 'center' }}>⛔ Your account is restricted. You cannot buy items.</p>
      ) : (
        <button
          className="btn-primary"
          style={{ width: '100%', marginTop: '1.5rem' }}
          onClick={() => addToCart(listing.discid)}
        >
          Add to Cart
        </button>
      )}
    </div>
  );

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Marketplace</h1>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Sort By</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {promotedListings.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Star size={24} color="#ffd700" fill="#ffd700" /> Featured Promoted Listings
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
            {promotedListings.map(listing => <ListingCard key={listing.listingid} listing={listing} />)}
          </div>
        </div>
      )}

      <div>
        <h2 style={{ marginBottom: '1.5rem' }}>All Listings</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
          {regularListings.map(listing => <ListingCard key={listing.listingid} listing={listing} />)}
        </div>
      </div>
    </div>
  );
}

function SellerDashboard({ currentUser, isRestricted }) {
  const [listings, setListings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newListing, setNewListing] = useState({ title: '', details: '', year: '', format: '', condition: 'Good', price: '' });

  useEffect(() => {
    if (currentUser.role === 'seller') {
      fetchListings();
    }
  }, [currentUser]);

  const fetchListings = async () => {
    try {
      const res = await axios.get(`${API_URL}/seller/listings/${currentUser.id}`);
      setListings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const changePrice = async (id) => {
    const newPrice = prompt("Enter new price:");
    if (!newPrice) return;
    try {
      await axios.put(`${API_URL}/listings/${id}/price`, { price: newPrice });
      fetchListings();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleVisibility = async (id, currentStatus) => {
    try {
      await axios.put(`${API_URL}/listings/${id}/visibility`, { isPublic: !currentStatus });
      fetchListings();
    } catch (err) {
      console.error(err);
    }
  };

  const promote = async (id) => {
    try {
      await axios.put(`${API_URL}/listings/${id}/promote`);
      fetchListings();
      alert("Promotion requested!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/seller/listings`, {
        sellerId: currentUser.id,
        ...newListing
      });
      setShowForm(false);
      setNewListing({ title: '', details: '', year: '', format: '', condition: 'Good', price: '' });
      fetchListings();
      alert('Listing created successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to create listing');
    }
  };

  if (currentUser.role !== 'seller') return <div>Access Denied</div>;

  if (isRestricted) return (
    <div style={{ textAlign: 'center', marginTop: '5rem' }}>
      <h2 style={{ color: 'var(--danger)' }}>⛔ Account Restricted</h2>
      <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Your account has been restricted. You cannot create or manage listings.</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Your Listings</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add New Listing'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateListing} className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'grid', gap: '1rem' }}>
          <input type="text" placeholder="Disc Title" required value={newListing.title} onChange={e => setNewListing({ ...newListing, title: e.target.value })} />
          <textarea placeholder="Details/Description" value={newListing.details} onChange={e => setNewListing({ ...newListing, details: e.target.value })} style={{ minHeight: '80px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input type="number" placeholder="Release Year" value={newListing.year} onChange={e => setNewListing({ ...newListing, year: e.target.value })} />
            <input type="text" placeholder="Format (e.g. PS4, DVD)" required value={newListing.format} onChange={e => setNewListing({ ...newListing, format: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <select value={newListing.condition} onChange={e => setNewListing({ ...newListing, condition: e.target.value })} style={{ padding: '0.8rem', borderRadius: '0.5rem', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--glass-border)' }}>
              <option value="New">New</option>
              <option value="Like New">Like New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
            </select>
            <input type="number" step="0.01" placeholder="Price ($)" required value={newListing.price} onChange={e => setNewListing({ ...newListing, price: e.target.value })} />
          </div>
          <button type="submit" className="btn-success">Submit Listing</button>
        </form>
      )}

      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }} className="glass">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <th style={{ padding: '1rem' }}>Title</th>
            <th style={{ padding: '1rem' }}>Price</th>
            <th style={{ padding: '1rem' }}>Status</th>
            <th style={{ padding: '1rem' }}>Promoted</th>
            <th style={{ padding: '1rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {listings.map(l => (
            <tr key={l.listingid} style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <td style={{ padding: '1rem' }}>{l.title} {l.status === 'Sold' && <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>(SOLD)</span>}</td>
              <td style={{ padding: '1rem' }}>${l.price}</td>
              <td style={{ padding: '1rem' }}>{l.is_public ? 'Public' : 'Private'}</td>
              <td style={{ padding: '1rem' }}>{l.is_promoted ? (l.promote_approved ? 'Yes' : 'Pending') : 'No'}</td>
              <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" onClick={() => changePrice(l.listingid)} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>Price</button>
                <button className="btn-secondary" onClick={() => toggleVisibility(l.listingid, l.is_public)} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>{l.is_public ? 'Make Private' : 'Make Public'}</button>
                {!l.is_promoted && l.status !== 'Sold' && <button className="btn-primary" onClick={() => promote(l.listingid)} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>Promote</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [promotions, setPromotions] = useState([]);

  useEffect(() => {
    if (currentUser.role === 'admin') {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    try {
      const usersRes = await axios.get(`${API_URL}/admin/users`);
      setUsers(usersRes.data);
      const promRes = await axios.get(`${API_URL}/admin/promotions`);
      setPromotions(promRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const restrictUser = async (id) => {
    const reason = prompt("Enter restriction reason:");
    if (!reason) return;
    try {
      await axios.put(`${API_URL}/admin/users/${id}/restrict`, { adminId: currentUser.id, reason });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const unrestrictUser = async (id) => {
    try {
      await axios.put(`${API_URL}/admin/users/${id}/unrestrict`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const approvePromotion = async (id) => {
    try {
      await axios.put(`${API_URL}/admin/listings/${id}/approve`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const unlistListing = async (id) => {
    try {
      await axios.put(`${API_URL}/admin/listings/${id}/unlist`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (currentUser.role !== 'admin') return <div>Access Denied</div>;

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Admin Panel</h1>

      <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Pending Promotions</h2>
      <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        {promotions.length === 0 ? <p>No pending promotions.</p> :
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {promotions.map(p => (
              <li key={p.listingid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                <div>
                  <strong>{p.title}</strong> by {p.sellername} - ${p.price}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-success" onClick={() => approvePromotion(p.listingid)}>Approve</button>
                  <button className="btn-danger" onClick={() => unlistListing(p.listingid)}>Unlist</button>
                </div>
              </li>
            ))}
          </ul>
        }
      </div>

      <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Users</h2>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }} className="glass">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <th style={{ padding: '1rem' }}>Name</th>
            <th style={{ padding: '1rem' }}>Email</th>
            <th style={{ padding: '1rem' }}>Access</th>
            <th style={{ padding: '1rem' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.userid} style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <td style={{ padding: '1rem' }}>{u.name}</td>
              <td style={{ padding: '1rem' }}>{u.email}</td>
              <td style={{ padding: '1rem' }}>
                <span style={{ color: u.access === 'restricted' ? 'var(--danger)' : 'var(--success)' }}>{u.access}</span>
              </td>
              <td style={{ padding: '1rem' }}>
                {u.access !== 'restricted' && <button className="btn-danger" onClick={() => restrictUser(u.userid)} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>Restrict</button>}
                {u.access === 'restricted' && <button onClick={() => unrestrictUser(u.userid)} style={{ padding: '0.5rem', fontSize: '0.8rem', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' }}>Unrestrict</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CartDrawer({ userId, isRestricted, onClose, onCheckoutComplete }) {
  const [items, setItems] = useState([]);

  const handleCheckout = async () => {
    try {
      await axios.post(`${API_URL}/checkout`, { userId, items });
      onCheckoutComplete(items);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Checkout failed');
    }
  };

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const res = await axios.get(`${API_URL}/cart/${userId}`);
        setItems(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCart();
  }, [userId]);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '350px',
      background: 'var(--bg-dark)', zIndex: 100, padding: '2rem',
      boxShadow: '-5px 0 30px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column'
    }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Your Cart</h2>
        <button className="btn-secondary" onClick={onClose} style={{ padding: '0.5rem' }}>X</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.length === 0 ? <p>Cart is empty</p> : items.map((item, idx) => (
          <div key={idx} style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
            <div style={{ fontWeight: 'bold' }}>{item.title}</div>
            <div className="gradient-text">${item.price}</div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        isRestricted
          ? <p style={{ color: 'var(--danger)', marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem' }}>⛔ Your account is restricted. You cannot checkout.</p>
          : <button className="btn-primary" style={{ marginTop: '2rem' }} onClick={handleCheckout}>Checkout</button>
      )}
    </div>
  );
}

function BuyerInventory({ currentUser }) {
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    if (currentUser.role === 'buyer') {
      fetchPurchases();
    }
  }, [currentUser]);

  const fetchPurchases = async () => {
    try {
      const res = await axios.get(`${API_URL}/inventory/${currentUser.id}`);
      setPurchases(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (currentUser.role !== 'buyer') return <div>Access Denied</div>;

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>My Purchases</h1>
      {purchases.length === 0 ? (
        <p>You haven't bought anything yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
          {purchases.map(p => (
            <div key={p.txid} className="glass" style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.75rem', fontFamily: 'monospace' }}>
                🧾 {p.txid}
              </p>
              <h3>{p.title}</h3>
              <p style={{ color: 'var(--text-muted)' }}>Format: {p.format || 'Unknown'} | Year: {p.year}</p>
              <p style={{ marginTop: '1rem' }}>
                <strong>Purchased on:</strong> {new Date(p.purchase_date).toLocaleDateString()}
              </p>
              <p className="gradient-text" style={{ fontWeight: 'bold', fontSize: '1.2rem', marginTop: '0.5rem' }}>
                ${p.purchase_price}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingModal({ sellers, raterId, onClose }) {
  const [ratings, setRatings] = useState({});

  const handleStarClick = (sellerId, score) => {
    setRatings(prev => ({ ...prev, [sellerId]: score }));
  };

  const submitRatings = async () => {
    try {
      for (let sellerId of Object.keys(ratings)) {
        if (ratings[sellerId]) {
          await axios.post(`${API_URL}/ratings`, {
            raterId,
            ratedId: sellerId,
            score: ratings[sellerId]
          });
        }
      }
      alert('Thank you for your ratings!');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to submit ratings');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass" style={{ padding: '2rem', width: '400px', maxWidth: '90%' }}>
        <h2 style={{ marginBottom: '1rem' }}>Rate Your Sellers!</h2>
        <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>Please rate the sellers from your recent purchase.</p>

        {sellers.map(seller => (
          <div key={seller.seller_id} style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{seller.sellername}</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  size={32}
                  style={{ cursor: 'pointer' }}
                  color={ratings[seller.seller_id] >= star ? '#ffd700' : 'var(--text-muted)'}
                  fill={ratings[seller.seller_id] >= star ? '#ffd700' : 'none'}
                  onClick={() => handleStarClick(seller.seller_id, star)}
                />
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Skip</button>
          <button className="btn-success" onClick={submitRatings} style={{ flex: 1 }}>Submit</button>
        </div>
      </div>
    </div>
  );
}

function RegisterModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'buyer' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/register`, form);
      onSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass" style={{ padding: '2rem', width: '400px', maxWidth: '90%' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Create an Account</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Join SpinSync as a Buyer or Seller.</p>

        {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Full Name"
            required
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email Address"
            required
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setForm({ ...form, role: 'buyer' })}
              style={{
                padding: '0.8rem', borderRadius: '0.5rem', border: '2px solid',
                borderColor: form.role === 'buyer' ? 'var(--primary)' : 'var(--glass-border)',
                background: form.role === 'buyer' ? 'rgba(99,102,241,0.2)' : 'var(--bg-dark)',
                color: 'white', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              🛒 Buyer
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, role: 'seller' })}
              style={{
                padding: '0.8rem', borderRadius: '0.5rem', border: '2px solid',
                borderColor: form.role === 'seller' ? 'var(--primary)' : 'var(--glass-border)',
                background: form.role === 'seller' ? 'rgba(99,102,241,0.2)' : 'var(--bg-dark)',
                color: 'white', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              🏪 Seller
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
