-- Corrected SQL Schema

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    profilePic TEXT  -- Add this column to store profile picture filenames
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT,
    time TEXT,
    image TEXT,
    location TEXT,
    username TEXT
);

-- db_schema.sql
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    views INTEGER DEFAULT 0
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES posts(id)
);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES posts(id)
);

-- Create pictures table
CREATE TABLE IF NOT EXISTS pictures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    description TEXT NOT NULL,
    likes INTEGER DEFAULT 0
);

-- These ALTER TABLE commands should only be run once. If you've already added these columns, skip these commands.
ALTER TABLE tasks ADD COLUMN date TEXT;
ALTER TABLE tasks ADD COLUMN time TEXT;



