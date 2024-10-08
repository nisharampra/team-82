import express from 'express';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import session from 'express-session';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url'; // Import for ES module __dirname fix

// Construct __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
const router = express.Router();

// Set up the database
const db = new sqlite3.Database("./database.db");

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  session({ secret: "your-secret-key", resave: false, saveUninitialized: true })
);

app.use(express.static("views"));
app.use(express.static("node_modules"));
app.use(express.static(path.join(__dirname, "/views"))); // Use path.join with __dirname

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, path.join(__dirname, 'uploads/')); // Use path.join for uploads directory
  },
  filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname); // Unique filename
  }
});
const upload = multer({ storage: storage });


// Route to handle profile picture upload
app.post('/settings/profile-pic', upload.single('profilePic'), (req, res) => {
  const profilePic = req.file.filename;
  const userId = req.session.userId; // Assuming you have user sessions set up

  db.run('UPDATE users SET profilePic = ? WHERE id = ?', [profilePic, userId], (err) => {
      if (err) {
          console.error(err.message);
          return res.status(500).send('Error updating profile picture');
      }
      res.redirect('/home');
  });
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
app.get("/", (req, res) => {
  res.render("index");
});

// Route to render the registration form
app.get("/register", (req, res) => {
  res.render("register", { message: "" });
});

// Route to render edit tasks page
app.get("/tasks/edit/:id", (req, res) => {
  const taskId = req.params.id;
  findTaskById(taskId, (err, task) => {
    if (err) {
      return res.status(500).send("Error fetching task.");
    }
    if (!task) {
      return res.status(404).send("Task not found.");
    }
    res.render("edit-task", { task });
  });
});

/* app.get("/home", (req, res) => {
  const username = req.session.username;
  if (!username) {
    return res.redirect("/login");
  }

  db.all("SELECT * FROM tasks WHERE username = ?", [username], (err, tasks) => {
    if (err) {
      console.error("Error querying database:", err.message);
      return res.status(500).send("Internal Server Error");
    }
    res.render("home", { username, tasks });
  });
}); */

app.get('/home', (req, res) => {
  const username = req.session.username;
  if (!username) {
      return res.redirect('/login');
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err) {
          console.error('Error querying database:', err.message);
          return res.status(500).send('Internal Server Error');
      }

      db.all('SELECT * FROM tasks WHERE username = ?', [username], (err, tasks) => {
          if (err) {
              console.error('Error querying database:', err.message);
              return res.status(500).send('Internal Server Error');
          }

          // Pass profilePic from user object to the template
          res.render('home', { username, profilePic: user.profilePic, tasks });
      });
  });
});

app.use('/uploads', express.static('uploads'));




// Route to handle registration form submission
app.post("/register", (req, res) => {
  const { username, email, password } = req.body;

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err.message);
      return res.status(500).send("Internal Server Error");
    }

    const query =
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
    db.run(query, [username, email, hashedPassword], function (err) {
      if (err) {
        console.error("Error inserting user into database:", err.message);
        return res.render("register", {
          message: "Registration failed. Please try again.",
        });
      }
      res.redirect("/login");
    });
  });
});

// Route to handle modification of edited tasks
app.post("/tasks/update/:id", upload.single("image"), (req, res) => {
  const taskId = req.params.id;
  const { title, description, date, time, location } = req.body;
  const image = req.file ? req.file.filename : req.body.currentImage;

  const updatedTask = {
    title,
    description,
    date,
    time,
    location,
    image,
  };

  updateTask(taskId, updatedTask, (err) => {
    if (err) {
      console.error("Error updating task:", err.message);
      return res.status(500).send("Internal Server Error");
    }
    res.redirect("/home");
  });
});

// Function to find a task by ID
function findTaskById(id, callback) {
  db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, row) => {
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

  db.run(
    query,
    [title, description, date, time, location, image, id],
    function (err) {
      if (err) {
        return callback(err);
      }
      callback(null);
    }
  );
}

// Route to render the login form
app.get("/login", (req, res) => {
  res.render("login", { message: "" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
    if (err) {
      console.error("Error querying database:", err.message);
      return res.render("login", {
        message: "Login failed. Please try again.",
      });
    }
    if (!row) {
      return res.render("login", { message: "User not found" });
    }

    bcrypt.compare(password, row.password, (err, result) => {
      if (err) {
        console.error("Error comparing passwords:", err.message);
        return res.render("login", {
          message: "Login failed. Please try again.",
        });
      }
      if (result) {
        req.session.userId = row.id;
        req.session.username = row.username;
        res.redirect("/home");
      } else {
        res.render("login", { message: "Incorrect password" });
      }
    });
  });
});

//Route to render manage notes
app.get("/notes", (req, res) => {
  // Example: Fetch notes from the database and render the 'notes' view
  db.all("SELECT * FROM notes", (err, rows) => {
    if (err) {
      console.error("Error fetching notes:", err.message);
      return res.status(500).send("Internal Server Error");
    }
    res.render("notes", { notes: rows });
  });
});

// Route to render the "Add a New Note" form
app.get("/notes/new", (req, res) => {
  res.render("new-note", { message: "" });
});
app.post("/notes", (req, res) => {
  const { title, content } = req.body;

  // Insert the new note into the database
  db.run(
    "INSERT INTO notes (title, content) VALUES (?, ?)",
    [title, content],
    function (err) {
      if (err) {
        console.error("Error inserting note into database:", err.message);
        return res.render("new-note", {
          message: "Note creation failed. Please try again.",
        });
      }
      res.redirect("/notes");
    }
  );
});

// Route to remove a note
app.post('/notes/delete/:id', (req, res) => {
  const noteId = req.params.id;

  const query = `DELETE FROM notes WHERE id = ?`;

  db.run(query, [noteId], function (err) {
    if (err) {
      console.error('Error deleting note:', err);
      return res.status(500).send('An error occurred while deleting the note.');
    }

    res.redirect('/notes');
  });
});

// Route to render the settings page
app.get("/settings", (req, res) => {
  const username = req.session.username;
  if (!username) {
    return res.redirect("/login");
  }

  res.render("settings", { username });
});

// Route to render the task creation form
app.get("/tasks/new", (req, res) => {
  const username = req.session.username;
  if (!username) {
    return res.redirect("/login");
  }
  res.render("new-task", { username, message: "" });
});

// Route to handle task creation
app.post("/tasks", upload.single("image"), (req, res) => {
  const { title, description, date, time, location } = req.body;
  const username = req.session.username;
  if (!username) {
    return res.redirect("/login");
  }

  const image = req.file ? req.file.filename : null;

  db.run(
    "INSERT INTO tasks (title, description, date, time, image, location, username) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [title, description, date, time, image, location, username],
    function (err) {
      if (err) {
        console.error("Error inserting task into database:", err.message);
        return res.render("new-task", {
          username,
          message: "Task creation failed. Please try again.",
        });
      }
      res.redirect("/home");
    }
  );
});

// Route to handle task deletion
app.post("/tasks/delete/:id", (req, res) => {
  const taskId = req.params.id;

  // Delete task from the database
  db.run("DELETE FROM tasks WHERE id = ?", [taskId], function (err) {
    if (err) {
      console.error("Error deleting task:", err.message);
      return res.status(500).send("Internal Server Error");
    }

    // Redirect back to the home page
    res.redirect("/home");
  });
});

// Route to handle logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Route to render the Community Page
app.get("/community", (req, res) => {
  const query = "SELECT * FROM pictures"; // Query should be in quotes
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Database error."); // Ensure return to stop further execution
    } else {
      res.render("community", { pictures: rows });
    }
  });
});

// Route to handle picture uploads
app.post("/community/upload", upload.single("picture"), (req, res) => {
  const file = req.file;
  const description = req.body.description;

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  const query = "INSERT INTO pictures (filename, description) VALUES (?, ?)";
  db.run(query, [file.filename, description], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Database error.");
    } else {
      res.redirect("/community");
    }
  });
});

// Route to handle likes
app.post("/community/like/:id", (req, res) => {
  const id = req.params.id;
  const query = "UPDATE pictures SET likes = likes + 1 WHERE id = ?";
  db.run(query, [id], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Database error.");
    } else {
      res.redirect("/community");
    }
  });
});

// Route to render a shared task view
app.get("/tasks/view/:id", (req, res) => {
  const taskId = req.params.id;

  findTaskById(taskId, (err, task) => {
    if (err) {
      console.error("Error fetching task:", err.message);
      return res.status(500).send("Internal Server Error");
    }
    if (!task) {
      return res.status(404).send("Task not found.");
    }
    res.render("view-shared-task", { task });
  });
});

app.use(
  ["/home", "/tasks/*", "/settings", "/community", "/notes/*"],
  isAuthenticated
);

//route to handle password reset
app.post("/settings/password", (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.session.userId;

  if (newPassword !== confirmPassword) {
    return res.status(400).send("New passwords do not match");
  }

  db.get("SELECT password FROM users WHERE id = ?", [userId], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Database error");
    }

    if (!row) {
      return res.status(400).send("User not found");
    }

    bcrypt.compare(currentPassword, row.password, (err, isMatch) => {
      if (err || !isMatch) {
        console.error(err ? err.message : "Incorrect password");
        return res.status(400).send("Current password is incorrect");
      }

      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) {
          console.error(err.message);
          return res.status(500).send("Error hashing new password");
        }

        db.run(
          "UPDATE users SET password = ? WHERE id = ?",
          [hash, userId],
          function (err) {
            if (err) {
              console.error(err.message);
              return res.status(500).send("Database error");
            }
            req.session.destroy(); // Log the user out after password reset
            res.redirect("/login");
          }
        );
      });
    });
  });
});

function isAuthenticated(req, res, next) {
  if (req.session && req.session.username) {
    db.get(
      "SELECT * FROM users WHERE username = ?",
      [req.session.username],
      (err, user) => {
        if (err || !user) {
          return res.redirect("/login");
        }
        req.user = user; // Set req.user for later use
        next();
      }
    );
  } else {
    res.redirect("/login");
  }
}

app.post("/settings/username", (req, res) => {
  const newUsername = req.body.username;
  const userId = req.user.id;

  db.run(
    "UPDATE users SET username = ? WHERE id = ?",
    [newUsername, userId],
    (err) => {
      if (err) {
        console.error(err.message);
        return res.status(500).send("Database error");
      }

      // Update session with the new username
      req.session.username = newUsername;

      res.redirect("/home");
    }
  );
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error logging out:", err);
      return res.redirect("/home"); // Redirect to home page if there's an error
    }
    res.redirect("/login"); // Redirect to login page after logout
  });
});

app.use(
  ["/home", "/tasks/*", "/settings", "/community", "/notes/*"],
  isAuthenticated
);

// Forgot password route
app.get("/forgot-password", (req, res) => {
  res.render("forgot-password", { message: "" });
});

// Forgot password route
app.post("/forgot-password", (req, res) => {
  const { username } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err || !user) {
      return res.render("forgot-password", { message: "User not found" });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // Token valid for 1 hour

    // Store the reset token and its expiry in the database
    db.run(
      "UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE username = ?",
      [resetToken, resetTokenExpiry, username],
      (err) => {
        if (err) {
          console.error(err.message);
          return res.render("forgot-password", {
            message: "Error updating reset token",
          });
        }

        // Render a page with the token
        res.render("enter-token", {
          message: "Token has been generated. Please enter it to verify.",
          token: resetToken,
        });
      }
    );
  });
});

// Page to enter reset token
app.get("/verify-token", (req, res) => {
  res.render("verify-token", { message: "" });
});

app.post("/verify-token", (req, res) => {
  const { token } = req.body;

  db.get(
    "SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > ?",
    [token, Date.now()],
    (err, user) => {
      if (err || !user) {
        return res.render("verify-token", {
          message: "Invalid or expired token",
        });
      }

      res.render("reset-password", { token, message: "" });
    }
  );
});

app.get("/reset-password/:token", (req, res) => {
  const { token } = req.params;

  db.get(
    "SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > ?",
    [token, Date.now()],
    (err, user) => {
      if (err || !user) {
        return res.render("login", { message: "Invalid or expired token" });
      }

      // Render reset password form with the valid token
      res.render("reset-password", { token, message: "" });
    }
  );
});
app.post("/reset-password/:token", (req, res) => {
  const { token } = req.params;
  const { newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.render("reset-password", {
      message: "Passwords do not match",
      token,
    });
  }

  db.get(
    "SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > ?",
    [token, Date.now()],
    (err, user) => {
      if (err || !user) {
        return res.render("reset-password", {
          message: "Invalid or expired token",
          token,
        });
      }

      bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
        if (err) {
          console.error(err.message);
          return res.render("reset-password", {
            message: "Error hashing password",
            token,
          });
        }

        db.run(
          "UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?",
          [hashedPassword, user.id],
          (err) => {
            if (err) {
              console.error(err.message);
              return res.render("reset-password", {
                message: "Error updating password",
                token,
              });
            }

            res.redirect("/login");
          }
        );
      });
    }
  );
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export { app };