-- Create Database: cse370_project
-- (Note: You should create the database manually using `CREATE DATABASE cse370_project;` before running this script)

CREATE TABLE Users (
    UserID SERIAL PRIMARY KEY,
    Name VARCHAR(255) NOT NULL,
    Email VARCHAR(255) UNIQUE NOT NULL,
    BirthDate DATE,
    RegDate DATE DEFAULT CURRENT_DATE,
    Buy_Flag BOOLEAN DEFAULT true,
    Sell_Flag BOOLEAN DEFAULT true,
    Admin_Flag BOOLEAN DEFAULT false,
    Access VARCHAR(255) DEFAULT 'active'
);

CREATE TABLE Discs (
    DiscID SERIAL PRIMARY KEY,
    Title VARCHAR(255) NOT NULL,
    Details TEXT,
    Year INTEGER
);

CREATE TABLE Disc_Formats (
    DiscID INTEGER REFERENCES Discs(DiscID) ON DELETE CASCADE,
    Format VARCHAR(255) NOT NULL,
    PRIMARY KEY(DiscID, Format)
);

CREATE TABLE Listings (
    ListingID SERIAL PRIMARY KEY,
    DiscID INTEGER REFERENCES Discs(DiscID) ON DELETE CASCADE,
    Seller_ID INTEGER REFERENCES Users(UserID) ON DELETE CASCADE,
    Condition VARCHAR(255),
    Status VARCHAR(50) DEFAULT 'Active',
    Price DECIMAL(10, 2) NOT NULL,
    Is_Public BOOLEAN DEFAULT true,
    Is_Promoted BOOLEAN DEFAULT false,
    Promote_Approved BOOLEAN DEFAULT false
);

CREATE TABLE Purchases (
    PurchaseID SERIAL PRIMARY KEY,
    ListingID INTEGER REFERENCES Listings(ListingID) ON DELETE CASCADE,
    Buyer_ID INTEGER REFERENCES Users(UserID) ON DELETE SET NULL,
    Purchase_Price DECIMAL(10, 2) NOT NULL,
    Purchase_Date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE Ratings (
    Rate_ID SERIAL PRIMARY KEY,
    Score INTEGER NOT NULL CHECK (Score >= 1 AND Score <= 5),
    Rater_ID INTEGER REFERENCES Users(UserID) ON DELETE CASCADE,
    Rated_ID INTEGER REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE TABLE Cart (
    User_ID INTEGER REFERENCES Users(UserID) ON DELETE CASCADE,
    Disc_ID INTEGER REFERENCES Discs(DiscID) ON DELETE CASCADE,
    PRIMARY KEY(User_ID, Disc_ID)
);

CREATE TABLE Restrictions (
    Mod_ID INTEGER REFERENCES Users(UserID) ON DELETE CASCADE,
    Crim_ID INTEGER REFERENCES Users(UserID) ON DELETE CASCADE,
    Reason TEXT NOT NULL,
    PRIMARY KEY(Mod_ID, Crim_ID)
);

CREATE TABLE Logs (
    Log_ID SERIAL PRIMARY KEY,
    Mod_ID INTEGER REFERENCES Users(UserID) ON DELETE SET NULL,
    Disc_ID INTEGER REFERENCES Discs(DiscID) ON DELETE SET NULL,
    Rate_ID INTEGER REFERENCES Ratings(Rate_ID) ON DELETE SET NULL,
    Action_Type VARCHAR(255),
    Log_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mock Data for quick testing

INSERT INTO Users (Name, Email, Buy_Flag, Sell_Flag, Admin_Flag) VALUES 
('Buyer Bob', 'buyer@test.com', true, false, false),
('Seller Sally', 'seller@test.com', false, true, false),
('Admin Adam', 'admin@test.com', true, true, true);

INSERT INTO Discs (Title, Details, Year) VALUES 
('Halo 3', 'No scratches, comes with manual', 2007),
('Super Smash Bros Melee', 'Disc only', 2001),
('Persona 5 Royal', 'Sealed', 2020);

INSERT INTO Disc_Formats (DiscID, Format) VALUES 
(1, 'Xbox 360'),
(2, 'GameCube'),
(3, 'PlayStation 4');

INSERT INTO Listings (DiscID, Seller_ID, Condition, Status, Price, Is_Public, Is_Promoted, Promote_Approved) VALUES 
(1, 2, 'Good', 'Active', 15.00, true, false, false),
(2, 2, 'Fair', 'Active', 45.00, true, true, true),
(3, 2, 'Like New', 'Sold', 35.00, false, true, false);

-- A past transaction / Purchase
INSERT INTO Purchases (ListingID, Buyer_ID, Purchase_Price, Purchase_Date) VALUES 
(3, 1, 35.00, '2023-10-01');
