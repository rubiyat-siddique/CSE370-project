const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());


// --- BUYER ENDPOINTS ---

//  Search and Sort Listings
app.get('/api/listings', async (req, res) => {
    try {
        const { search, sort } = req.query;
        let queryStr = `
            SELECT l.ListingID, l.Price, l.Condition, l.Status, d.DiscID, d.Title, d.Year, f.Format, u.Name as SellerName, l.Is_Promoted, l.Promote_Approved
            FROM Listings l
            JOIN Discs d ON l.DiscID = d.DiscID
            LEFT JOIN Disc_Formats f ON d.DiscID = f.DiscID
            JOIN Users u ON l.Seller_ID = u.UserID
            WHERE l.Status = 'Active' AND l.Is_Public = true
        `;
        let params = [];
        let paramIndex = 1;

        if (search) {
            queryStr += ` AND d.Title ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (sort === 'price_asc') {
            queryStr += ` ORDER BY l.Price ASC`;
        } else if (sort === 'price_desc') {
            queryStr += ` ORDER BY l.Price DESC`;
        }

        const result = await pool.query(queryStr, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

//  Get User Profile
app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT UserID, Name, Email, Access, Buy_Flag, Sell_Flag, Admin_Flag FROM Users WHERE UserID = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Register New User (Buyer or Seller)
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, role } = req.body;
        if (!name || !email || !role) {
            return res.status(400).json({ error: 'Name, email, and role are required' });
        }
        if (role !== 'buyer' && role !== 'seller') {
            return res.status(400).json({ error: 'Role must be buyer or seller' });
        }
        const buyFlag = role === 'buyer';
        const sellFlag = role === 'seller';
        const result = await pool.query(
            'INSERT INTO Users (Name, Email, Buy_Flag, Sell_Flag) VALUES ($1, $2, $3, $4) RETURNING UserID, Name, Email, Access, Buy_Flag, Sell_Flag',
            [name, email, buyFlag, sellFlag]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add to Cart
app.post('/api/cart', async (req, res) => {
    try {
        const { userId, discId } = req.body;
        const result = await pool.query(
            'INSERT INTO Cart (User_ID, Disc_ID) VALUES ($1, $2) RETURNING *',
            [userId, discId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // Unique violation
            res.status(400).json({ error: 'Already in cart' });
        } else {
            console.error(err.message);
            res.status(500).json({ error: 'Server error' });
        }
    }
});

// Get Cart
app.get('/api/cart/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(`
            SELECT c.Disc_ID, d.Title, l.Price, l.ListingID, l.Seller_ID, u.Name as SellerName
            FROM Cart c
            JOIN Discs d ON c.Disc_ID = d.DiscID
            JOIN Listings l ON d.DiscID = l.DiscID
            JOIN Users u ON l.Seller_ID = u.UserID
            WHERE c.User_ID = $1 AND l.Status = 'Active'
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Checkout Cart
app.post('/api/checkout', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { userId, items } = req.body;

        for (let item of items) {
            await client.query(
                'INSERT INTO Purchases (ListingID, Buyer_ID, Purchase_Price) VALUES ($1, $2, $3)',
                [item.listingid, userId, item.price]
            );
            await client.query(
                "UPDATE Listings SET Status = 'Sold', Is_Public = false WHERE ListingID = $1",
                [item.listingid]
            );
        }

        await client.query('DELETE FROM Cart WHERE User_ID = $1', [userId]);
        await client.query('COMMIT');
        res.json({ message: 'Checkout successful' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// Get Buyer Inventory (Purchases)
app.get('/api/inventory/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(`
            SELECT p.PurchaseID, p.Purchase_Price, p.Purchase_Date, d.Title, d.Year, f.Format
            FROM Purchases p
            JOIN Listings l ON p.ListingID = l.ListingID
            JOIN Discs d ON l.DiscID = d.DiscID
            LEFT JOIN Disc_Formats f ON d.DiscID = f.DiscID
            WHERE p.Buyer_ID = $1
            ORDER BY p.Purchase_Date DESC
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Rate Seller
app.post('/api/ratings', async (req, res) => {
    try {
        const { raterId, ratedId, score } = req.body;
        const result = await pool.query(
            'INSERT INTO Ratings (Rater_ID, Rated_ID, Score) VALUES ($1, $2, $3) RETURNING *',
            [raterId, ratedId, score]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- SELLER ENDPOINTS ---

// Get Seller's Listings
app.get('/api/seller/listings/:sellerId', async (req, res) => {
    try {
        const { sellerId } = req.params;
        const result = await pool.query(`
            SELECT l.ListingID, l.Price, l.Condition, l.Status, l.Is_Public, l.Is_Promoted, l.Promote_Approved, d.Title
            FROM Listings l
            JOIN Discs d ON l.DiscID = d.DiscID
            WHERE l.Seller_ID = $1
        `, [sellerId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create New Listing (and Disc)
app.post('/api/seller/listings', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { sellerId, title, details, year, format, condition, price } = req.body;

        const parsedYear = year ? parseInt(year) : null;

        // 1. Create Disc
        const discResult = await client.query(
            'INSERT INTO Discs (Title, Details, Year) VALUES ($1, $2, $3) RETURNING DiscID',
            [title, details, parsedYear]
        );
        const discId = discResult.rows[0].discid;

        // 2. Add Format
        await client.query(
            'INSERT INTO Disc_Formats (DiscID, Format) VALUES ($1, $2)',
            [discId, format || 'Unknown']
        );

        // 3. Create Listing
        const listingResult = await client.query(
            'INSERT INTO Listings (DiscID, Seller_ID, Condition, Price) VALUES ($1, $2, $3, $4) RETURNING *',
            [discId, sellerId, condition, price]
        );

        await client.query('COMMIT');
        res.json(listingResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// Change Price
app.put('/api/listings/:id/price', async (req, res) => {
    try {
        const { id } = req.params;
        const { price } = req.body;
        const result = await pool.query(
            'UPDATE Listings SET Price = $1 WHERE ListingID = $2 RETURNING *',
            [price, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Change Visibility (Private/Public)
app.put('/api/listings/:id/visibility', async (req, res) => {
    try {
        const { id } = req.params;
        const { isPublic } = req.body;
        const result = await pool.query(
            'UPDATE Listings SET Is_Public = $1 WHERE ListingID = $2 RETURNING *',
            [isPublic, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Promote Listing
app.put('/api/listings/:id/promote', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "UPDATE Listings SET Is_Promoted = true WHERE ListingID = $1 AND Status != 'Sold' RETURNING *",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Cannot promote a sold listing or listing not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- ADMIN ENDPOINTS ---

// Restrict Account
app.put('/api/admin/users/:id/restrict', async (req, res) => {
    try {
        const { id } = req.params;
        const { adminId, reason } = req.body;

        // Update user access
        await pool.query('UPDATE Users SET Access = $1 WHERE UserID = $2', ['restricted', id]);

        // Log restriction
        await pool.query('INSERT INTO Restrictions (Mod_ID, Crim_ID, Reason) VALUES ($1, $2, $3)', [adminId, id, reason]);

        res.json({ message: 'User restricted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Unrestrict Account
app.put('/api/admin/users/:id/unrestrict', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('UPDATE Users SET Access = $1 WHERE UserID = $2', ['active', id]);
        res.json({ message: 'User unrestricted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Ratings
app.delete('/api/admin/ratings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM Ratings WHERE Rate_ID = $1', [id]);
        res.json({ message: 'Rating deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Unlist Listing
app.put('/api/admin/listings/:id/unlist', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'UPDATE Listings SET Is_Public = false WHERE ListingID = $1 RETURNING *',
            [id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Approve Featured Listing
app.put('/api/admin/listings/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'UPDATE Listings SET Promote_Approved = true WHERE ListingID = $1 RETURNING *',
            [id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all users for admin panel
app.get('/api/admin/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT UserID, Name, Email, Access FROM Users');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get pending promotions for admin
app.get('/api/admin/promotions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.ListingID, d.Title, l.Price, u.Name as SellerName
            FROM Listings l
            JOIN Discs d ON l.DiscID = d.DiscID
            JOIN Users u ON l.Seller_ID = u.UserID
            WHERE l.Is_Promoted = true AND l.Promote_Approved = false
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
