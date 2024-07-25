const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// Set up the database
const db = new sqlite3.Database('./your_database.db');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT
    )`);
});

// Route to render the index page
app.get('/', (req, res) => {
    res.render('index');
});


// Route to render the registration form
app.get('/register', (req, res) => {
    res.render('register', { message: '' });
});

// Route to handle registration form submission
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;

    // Hash the password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err.message);
            return res.status(500).send('Internal Server Error');
        }

        // Insert new user into the database
        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], function(err) {
            if (err) {
                console.error('Error inserting user into database:', err.message);
                return res.render('register', { message: 'Registration failed. Please try again.' });
            }
            res.redirect('/login');
        });
    });
});

// Route to render the login form
app.get('/login', (req, res) => {
    res.render('login', { message: '' });
});

// Route to handle login form submission
// app.post('/login', (req, res) => {
//     const { email, password } = req.body;

//     // Find user by email
//     db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
//         if (err) {
//             console.error('Error querying database:', err.message);
//             return res.render('login', { message: 'Login failed. Please try again.' });
//         }
//         if (!row) {
//             return res.render('login', { message: 'User not found' });
//         }

//         // Compare the hashed password
//         bcrypt.compare(password, row.password, (err, result) => {
//             if (err) {
//                 console.error('Error comparing passwords:', err.message);
//                 return res.render('login', { message: 'Login failed. Please try again.' });
//             }
//             if (result) {
//                 res.send(`<h1>Welcome, ${row.username}</h1>`);
//             } else {
//                 res.render('login', { message: 'Incorrect password' });
//             }
//         });
//     });
// });
// Route to handle login form submission
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Find user by email
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Error querying database:', err.message);
            return res.render('login', { message: 'Login failed. Please try again.' });
        }
        if (!row) {
            return res.render('login', { message: 'User not found' });
        }

        // Compare the hashed password
        bcrypt.compare(password, row.password, (err, result) => {
            if (err) {
                console.error('Error comparing passwords:', err.message);
                return res.render('login', { message: 'Login failed. Please try again.' });
            }
            if (result) {
                // Redirect to the home page with the username
                res.redirect(`/home?username=${encodeURIComponent(row.username)}`);
            } else {
                res.render('login', { message: 'Incorrect password' });
            }
        });
    });
});
// Route to render the home page
app.get('/home', (req, res) => {
    const username = req.query.username;
    if (!username) {
        return res.redirect('/login');
    }
    res.render('home', { username });
});
// Route to handle logout
app.get('/logout', (req, res) => {
    // Clear session or token if you have one
    res.redirect('/login');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
