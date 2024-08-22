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
//const upload = multer({ dest: 'uploads/' });

// Set up Multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/', // Directory to save uploaded files
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

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

    db.run(`CREATE TABLE IF NOT EXISTS pictures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        description TEXT NOT NULL,
        likes INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL
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

// Route to render edit tasks page
app.get('/tasks/edit/:id', (req, res) => {
    const taskId = req.params.id;
    findTaskById(taskId, (err, task) => {
        if (err) {
            return res.status(500).send('Error fetching task.');
        }
        if (!task) {
            return res.status(404).send('Task not found.');
        }
        res.render('edit-task', { task });
    });
});

app.get('/home', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.redirect('/login');
    }

    db.all('SELECT * FROM tasks WHERE username = ?', [username], (err, tasks) => {
        if (err) {
            console.error('Error querying database:', err.message);
            return res.status(500).send('Internal Server Error');
        }
        res.render('home', { username, tasks });
    });
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

// Route to handle modification of edited tasks
app.post('/tasks/update/:id', upload.single('image'), (req, res) => {
    const taskId = req.params.id;
    const { title, description, date, time, location } = req.body;
    const image = req.file ? req.file.filename : req.body.currentImage;

    const updatedTask = {
        title,
        description,
        date,
        time,
        location,
        image
    };

    updateTask(taskId, updatedTask, (err) => {
        if (err) {
            console.error('Error updating task:', err.message);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/home');
    });
});

// Function to find a task by ID
function findTaskById(id, callback) {
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) {
            return callback(err);
        }
        callback(null, row);
    });
}

// Function to update a task
function updateTask(id, updatedTask, callback) {
    const { title, description, date, time, location, image } = updatedTask;
    
    const query = `
        UPDATE tasks 
        SET title = ?, description = ?, date = ?, time = ?, location = ?, image = ?
        WHERE id = ?
    `;
    
    db.run(query, [title, description, date, time, location, image, id], function(err) {
        if (err) {
            return callback(err);
        }
        callback(null);
    });
}

// Route to render the login form
app.get('/login', (req, res) => {
    res.render('login', { message: '' });
});

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
                req.session.userId = row.id;
                req.session.username = row.username;
                res.redirect('/home');
            } else {
                res.render('login', { message: 'Incorrect password' });
            }
        });
    });
});




//Route to render manage notes 
app.get('/notes', (req, res) => {
    // Example: Fetch notes from the database and render the 'notes' view
    db.all('SELECT * FROM notes', (err, rows) => {
        if (err) {
            console.error('Error fetching notes:', err.message);
            return res.status(500).send('Internal Server Error');
        }
        res.render('notes', { notes: rows });
    });
});


// Route to render the "Add a New Note" form
app.get('/notes/new', (req, res) => {
    res.render('new-note', { message: '' });
});
app.post('/notes', (req, res) => {
    const { title, content } = req.body;

    // Insert the new note into the database
    db.run('INSERT INTO notes (title, content) VALUES (?, ?)', [title, content], function(err) {
        if (err) {
            console.error('Error inserting note into database:', err.message);
            return res.render('new-note', { message: 'Note creation failed. Please try again.' });
        }
        res.redirect('/notes');
    });
});



// Route to render the settings page
app.get('/settings', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.redirect('/login');
    }

    res.render('settings', { username });
});

// Route to handle the settings form submission
app.post('/settings', (req, res) => {
    const newUsername = req.body.username;
    const currentUsername = req.session.username;

    db.serialize(() => {
        // Update the username in the users table
        db.run('UPDATE users SET username = ? WHERE username = ?', [newUsername, currentUsername], function(err) {
            if (err) {
                console.error('Error updating username:', err.message);
                return res.status(500).send('Internal Server Error');
            }

            // Update the username in the tasks table
            db.run('UPDATE tasks SET username = ? WHERE username = ?', [newUsername, currentUsername], function(err) {
                if (err) {
                    console.error('Error updating tasks with new username:', err.message);
                    return res.status(500).send('Internal Server Error');
                }

                // Update session username
                req.session.username = newUsername;
                res.redirect('/home');
            });
        });
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
app.post('/tasks', upload.single('image'), (req, res) => {
    const { title, description, date, time, location } = req.body;
    const username = req.session.username;
    if (!username) {
        return res.redirect('/login');
    }

    const image = req.file ? req.file.filename : null;

    db.run('INSERT INTO tasks (title, description, date, time, image, location, username) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [title, description, date, time, image, location, username], 
        function(err) {
            if (err) {
                console.error('Error inserting task into database:', err.message);
                return res.render('new-task', { username, message: 'Task creation failed. Please try again.' });
            }
            res.redirect('/home');
        }
    );
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

// Route to render the Community Page
app.get('/community', (req, res) => {
    const query = `SELECT * FROM pictures`;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Database error.");
        } else {
            res.render('community', { pictures: rows });
        }
    });
});

// Route to handle picture uploads
app.post('/community/upload', upload.single('picture'), (req, res) => {
    const file = req.file;
    const description = req.body.description;
    
    if (!file) {
        return res.status(400).send('No file uploaded.');
    }

    const query = `INSERT INTO pictures (filename, description) VALUES (?, ?)`;
    db.run(query, [file.filename, description], function(err) {
        if (err) {
            console.error(err.message);
            res.status(500).send("Database error.");
        } else {
            res.redirect('/community');
        }
    });
});

// Route to handle likes
app.post('/community/like/:id', (req, res) => {
    const id = req.params.id;
    const query = `UPDATE pictures SET likes = likes + 1 WHERE id = ?`;
    db.run(query, [id], function(err) {
        if (err) {
            console.error(err.message);
            res.status(500).send("Database error.");
        } else {
            res.redirect('/community');
        }
    });
});

// Route to render a shared task view
app.get('/tasks/view/:id', (req, res) => {
    const taskId = req.params.id;

    findTaskById(taskId, (err, task) => {
        if (err) {
            console.error('Error fetching task:', err.message);
            return res.status(500).send('Internal Server Error');
        }
        if (!task) {
            return res.status(404).send('Task not found.');
        }
        res.render('view-shared-task', { task });
    });
});



app.post('/settings/password', (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.userId;

    if (newPassword !== confirmPassword) {
        return res.status(400).send('New passwords do not match');
    }

    db.get('SELECT password FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Database error');
        }

        if (!row) {
            return res.status(400).send('User not found');
        }

        bcrypt.compare(currentPassword, row.password, (err, isMatch) => {
            if (err || !isMatch) {
                console.error(err ? err.message : 'Incorrect password');
                return res.status(400).send('Current password is incorrect');
            }

            bcrypt.hash(newPassword, 10, (err, hash) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).send('Error hashing new password');
                }

                db.run('UPDATE users SET password = ? WHERE id = ?', [hash, userId], function(err) {
                    if (err) {
                        console.error(err.message);
                        return res.status(500).send('Database error');
                    }
                    req.session.destroy();  // Log the user out after password reset
                    res.redirect('/login');
                });
            });
        });
    });
});


// Apply isAuthenticated middleware to relevant routes 
app.use(['/home',
    '/tasks/*', '/settings', '/community', '/notes/*'], isAuthenticated); 

// Function to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
            if (err || !user) {
                return res.redirect('/login');
            }
            req.user = user;
            next();
        });
    } else {
        res.redirect('/login');
    }
}

app.post('/settings/username', (req, res) => {
    const newUsername = req.body.username;
    const userId = req.user.id;  // Ensure req.user is defined

    db.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Database error');
        }
        res.redirect('/home');
    });
});


app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error logging out:', err);
            return res.redirect('/home'); // Redirect to home page if there's an error
        }
        res.redirect('/login'); // Redirect to login page after logout
    });
});




// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});



