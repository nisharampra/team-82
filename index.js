const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3000;

// Set up the database
const db = new sqlite3.Database('./your_database.db');
// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({ secret: 'your-secret-key', resave: false, saveUninitialized: true }));

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.set('view engine', 'ejs');

// Create tables if they don't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT,
        time TEXT,
        image TEXT,
        location TEXT,
        username TEXT
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

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err.message);
            return res.status(500).send('Internal Server Error');
        }

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
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Error querying database:', err.message);
            return res.render('login', { message: 'Login failed. Please try again.' });
        }
        if (!row) {
            return res.render('login', { message: 'User not found' });
        }

        bcrypt.compare(password, row.password, (err, result) => {
            if (err) {
                console.error('Error comparing passwords:', err.message);
                return res.render('login', { message: 'Login failed. Please try again.' });
            }
            if (result) {
                req.session.username = row.username;
                res.redirect('/home');
            } else {
                res.render('login', { message: 'Incorrect password' });
            }
        });
    });
});




app.get('/home', (req, res) => {
    const username = req.session.username; // Assuming you have session management
    const query = `SELECT * FROM tasks WHERE username = ?`;

    db.all(query, [username], (err, tasks) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.render('home', { username: username, tasks: tasks });
    });
});

// Route to render the task creation form
app.get('/tasks/new', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.redirect('/login');
    }
    res.render('new-task', { username, message: '' });
});

// Route to handle task creation
// app.post('/tasks', upload.single('image'), (req, res) => {
//     const { title, description, date, time, location } = req.body;
//     const username = req.session.username;
//     if (!username) {
//         return res.redirect('/login');
//     }

//     const image = req.file ? req.file.filename : null;

//     db.run('INSERT INTO tasks (title, description, date, time, image, location, username) VALUES (?, ?, ?, ?, ?, ?, ?)', 
//         [title, description, date, time, image, location, username], 
//         function(err) {
//             if (err) {
//                 console.error('Error inserting task into database:', err.message);
//                 return res.render('new-task', { username, message: 'Task creation failed. Please try again.' });
//             }
//             res.redirect('/home');
//         }
//     );
// });
app.post('/tasks', upload.single('image'), (req, res) => {
    const { title, description, dueDate, dueTime, location } = req.body;
    const image = req.file ? req.file.filename : null;
    const username = req.session.username; // Assuming session management for logged-in user

    console.log("Form Data:", req.body); // Debugging log

    if (!title || !description || !dueDate || !dueTime) {
        return res.status(400).send("All required fields must be filled out.");
    }

    const query = `INSERT INTO tasks (title, description, date, time, image, location, username) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [title, description, dueDate, dueTime, image, location, username];

    db.run(query, params, function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Internal Server Error");
        }
        res.redirect('/home');
    });
});

// Route to handle task deletion
app.post('/tasks/delete/:id', (req, res) => {
    const taskId = req.params.id;

    // Delete task from the database
    db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
        if (err) {
            console.error('Error deleting task:', err.message);
            return res.status(500).send('Internal Server Error');
        }

        // Redirect back to the home page
        res.redirect('/home');
    });
});

// Route to handle logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});



// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
