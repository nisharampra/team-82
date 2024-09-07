import request from 'supertest';
import { expect } from 'chai';
import express from 'express';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt'; 
import { app } from '../index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '/');

// Helper function to generate a random string
const generateRandomString = (length) => {
    return Math.random().toString(36).substring(2, 2 + length);
  };

const dbPath = path.join(testDir, 'test_database.db');

describe('API Tests', () => {
    let agent;
    const uniqueEmail = `testuser1${generateRandomString(8)}@example.com`;
    const uniqueUsername = `testuser1${generateRandomString(8)}`;
    const testPassword = 'testpassword111';
    const testEmail = 'test1@example.com';
    const testUsername = 'testuser1';

    // Setup before tests
before(async () => {
    const db = new sqlite3.Database(dbPath);

    // Create tables and insert data
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create tables
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )`, (err) => {
                if (err) return reject(err);
            });

            db.run(`CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                date TEXT,
                time TEXT,
                image TEXT,
                location TEXT,
                username TEXT
            )`, (err) => {
                if (err) return reject(err);
            });

            db.run(`CREATE TABLE IF NOT EXISTS pictures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                description TEXT NOT NULL,
                likes INTEGER DEFAULT 0
            )`, (err) => {
                if (err) return reject(err);
            });

            db.run(`CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL
            )`, (err) => {
                if (err) return reject(err);
            });

            // Insert a test user
            bcrypt.hash(testPassword, 10, (err, hashedPassword) => {
                if (err) return reject(err);

                db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
                    [testUsername, testEmail, hashedPassword],
                    (err) => {
                        if (err) return reject(err);
                    }
                );
            });

            // Insert a test note
            db.run(`INSERT INTO notes (title, content) VALUES (?, ?)`,
                ['Test Note', 'This is a test note.'],
                (err) => {
                    if (err) return reject(err);
                }
            );

            // Insert a test task
            db.run(`INSERT INTO tasks (title, description, date, time, location, username) VALUES (?, ?, ?, ?, ?, ?)`,
                ['Task to Edit', 'This task will be edited', '2024-01-01', '10:00', 'Test Location', testUsername],
                function(err) {
                    if (err) {
                        console.error("Error inserting task:", err);
                        return reject(err);
                    } else {
                        console.log("Task inserted with ID:", this.lastID);
                        resolve();
                    }
                }
            );
        });
    });

    // Close database connection
    await new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) return reject(err);
            resolve();
        });
    });

    // Initialize Supertest agent
    agent = request.agent(app);
});


    // Teardown after tests
    after(async () => {
         // Open database connection
         const db = new sqlite3.Database(dbPath);

         // Clear all tables
         await new Promise((resolve, reject) => {
             db.serialize(() => {
                 db.run('DROP TABLE IF EXISTS users', (err) => {
                     if (err) reject(err);
                 });
                 db.run('DROP TABLE IF EXISTS notes', (err) => {
                     if (err) reject(err);
                 });
                 db.run('DROP TABLE IF EXISTS tasks', (err) => {
                     if (err) reject(err);
                 });
                 db.run('DROP TABLE IF EXISTS pictures', (err) => {
                     if (err) reject(err);
                 });
                 db.run('VACUUM', (err) => {
                     if (err) reject(err);
                     resolve();
                 });
             });
         });

        // Close database connection
        await new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Remove the test database file
        await fs.unlink(dbPath).catch(err => console.error('Error deleting test database file:', err));

    });

///////////////////////////////User Registration and Authentication///////////////////////////////////////
    
    // Test for rendering the register page
    it('should render register page', async () => {
        try {
            const res = await agent.get('/register');
            expect(res.status).to.equal(200);
            expect(res.text).to.include('Register');
        } catch (err) {
            throw err;
        }
    });

    // Test for registering a new user
    it('should register a new user', async () => {
        const res = await agent.post('/register')
            .send({
                username: uniqueUsername,
                email: uniqueEmail,
                password: testPassword,
            });
        expect(res.status).to.equal(302); 
    });

    // Test for handling registration of an already existing user
    it('should handle registration of already existing user', async () => {
        const res = await agent.post('/register')
            .send({
                username: testUsername, 
                email: testEmail,      
                password: testPassword,
            });
        expect(res.status).to.equal(200); 
        expect(res.text).to.include('Registration failed');
    });

    // Test for rendering the login page
    it('should render login page', (done) => {
        agent
            .get('/login')
            .expect(200)
            .end((err, res) => {
                if (err) return done(err);
                expect(res.text).to.include('Login');
                done();
            });
    });
    
    // Test for logging in with valid credentials
    it('should login with valid credentials', async () => {
        const res = await agent.post('/login')
            .send({
                email: testEmail,
                password: testPassword,
            });
        expect(res.status).to.equal(302); 
        expect(res.headers.location).to.equal('/home');
    });

    // Test for logging in with an invalid email
    it('should login with invalid email', async () => {
        const res = await agent.post('/login')
            .send({
                email: 'invalid@example.com', 
                password: testPassword,
            });
        expect(res.status).to.equal(200); 
        expect(res.text).to.include('User not found'); 
    });

    // Test for logging in with an incorrect password
    it('should login with incorrect password', async () => {
        const res = await agent.post('/login')
            .send({
                email: testEmail,
                password: 'wrongpassword', 
            });
        expect(res.status).to.equal(200); 
        expect(res.text).to.include('Incorrect password'); 
    });

    // Test for logging out the user and redirecting to the login page
    it('should log out the user and redirect to the login page', (done) => {
        agent
          .post('/login')
          .send({ 
            email: testEmail, 
            password: testPassword 
            })
          .end((err) => {
            if (err) return done(err);

            agent
              .post('/logout')
              .expect(302)
              .end((err, res) => {
                if (err) return done(err);  
                expect(res.header.location).to.equal('/login');
                done();
              });
          });
    });

///////////////////////////////Task Management///////////////////////////////////////    

    // Test for rendering the home page with user tasks
    it('should render the home page with user tasks', (done) => {
        agent
            .post('/login')
            .send({ 
                email: testEmail,
                password: testPassword 
            })
            .end((err) => {
                if (err) return done(err);

                agent
                    .get('/home')
                    .expect(200)
                    .end((err, res) => {
                        if (err) return done(err);
                        done();
                    });
            });
    });

     // Test for creating a new task
     it('should create a new task', (done) => {
        agent
            .post('/login')
            .send({ 
                email: testEmail, 
                password: testPassword 
            })
            .end((err) => {
                if (err) return done(err);
                
                agent
                    .post('/tasks')
                    .field('title', 'Test Task')
                    .field('description', 'This is a test task')
                    .field('date', '2024-01-01')
                    .field('time', '10:00')
                    .field('location', 'Test Location')
                    .expect(302)
                    .end((err, res) => {
                        if (err) return done(err);
                        expect(res.header.location).to.equal('/home');
                        done();
                    });
            });
    });

    // Test for updating a task and redirecting to the home page
    it('should update a task and redirect to the home page', (done) => {
        agent
          .post('/login')
          .send({ 
            email: testEmail,
            password: testPassword 
            })
          .end((err) => {
            if (err) return done(err);
      
            agent
              .post('/tasks')
              .send({
                title: 'Task to Update',
                description: 'This task will be updated',
                date: '2024-01-01',
                time: '10:00',
                location: 'Test Location',
                username: testUsername 
              })
              .end((err, res) => {
                if (err) return done(err);
      
                // Extract the ID of the newly created task from the response
                const taskId = res.body.id;
      
                // Prepare update data
                const updatedTitle = 'Updated Task Title';
                const updatedDescription = 'This task is now updated.';
                const updatedDate = '2024-01-02';
                const updatedTime = '11:00';
                const updatedLocation = 'New Location';
      
                agent
                  .post(`/tasks/update/${taskId}`)
                  .field('title', updatedTitle)
                  .field('description', updatedDescription)
                  .field('date', updatedDate)
                  .field('time', updatedTime)
                  .field('location', updatedLocation)
                  .expect(302) 
                  .end((err, res) => {
                    if (err) return done(err);
                    expect(res.header.location).to.equal('/home');
                    done();
                  });
              });
          });
      });

      // Test for deleting a task and redirecting to the home page
      it('should delete a task and redirect to the home page', (done) => {
        agent
          .post('/login')
          .send({ 
            email: testEmail, 
            password: testPassword 
            })
          .end((err) => {
            if (err) return done(err);
      
            agent
              .post('/tasks')
              .send({
                title: 'Task to Delete',
                description: 'This task will be deleted',
                date: '2024-01-01',
                time: '10:00',
                location: 'Test Location',
                username: testUsername
              })
              .end((err, res) => {
                if (err) return done(err);
                const taskId = res.body.id; 
      
                agent
                  .post(`/tasks/delete/${taskId}`)
                  .expect(302) // Expect a redirect
                  .end((err, res) => {
                    if (err) return done(err);
                    expect(res.header.location).to.equal('/home');
                    done();
                  });
              });
          });
      });

///////////////////////////////Note Management/////////////////////////////////////// 

    // Test for rendering the "Add a New Note" form
    it('should render the "Add a New Note" form', async () => {
        const res = await agent.get('/notes/new');
        expect(res.status).to.equal(200);
    });

    // Test for creating a new note and rendering the notes page
    it('should create a new note and render the notes page', (done) => {
        agent
            .post('/login')
            .send({
                email: testEmail, 
                password: testPassword 
            })
            .end((err) => {
                if (err) return done(err);

                agent
                    .post('/notes')
                    .send({
                        title: 'Test Note',
                        content: 'This is a test note.',
                    })
                    .expect(302)
                    .end((err) => {
                        if (err) return done(err);

                        agent
                            .get('/notes')
                            .expect(200)
                            .end((err, res) => {
                                if (err) return done(err);
                                expect(res.text).to.include('Test Note');
                                expect(res.text).to.include('This is a test note.');
                                done();
                            });
                    });
            });
    });

    // Test for deleting a note and redirecting to the notes page
    it('should delete a note and redirect to the notes page', (done) => {
        agent
            .post('/login')
            .send({ 
                email: testEmail, 
                password: testPassword 
            })
            .end((err) => {
                if (err) return done(err);

                // Insert a test note to delete
                agent
                    .post('/notes')
                    .send({
                        title: 'Note to Delete',
                        content: 'This note will be deleted',
                    })
                    .end((err, res) => {
                        if (err) return done(err);

                        const noteId = res.body.id; 

                        // Delete the note
                        agent
                            .post(`/notes/delete/${noteId}`)
                            .expect(302) 
                            .end((err, res) => {
                                if (err) return done(err);
                                expect(res.header.location).to.equal('/notes');
                                done();
                            });
                    });
            });
    });

///////////////////////////////Community interaction/////////////////////////////////////// 

    // Test for rendering the community page with pictures
    it('should render the community page with pictures', (done) => {
        agent
            .get('/community')
            .expect(200)
            .end((err, res) => {
                if (err) return done(err);
                expect(res.text).to.include('Community'); 
                done();
            });
    });

    // Test for incrementing the like count for a picture
    it('should increment the like count for a picture', (done) => {
        agent
            .post('/community/like/1') 
            .expect(302) 
            .end((err, res) => {
                if (err) return done(err);
                expect(res.header.location).to.equal('/community');
                done();
            });
    });

///////////////////////////////Settings Management/////////////////////////////////////// 

    // Test for rendering the settings page for authenticated users
    it('should render the settings page for authenticated users', (done) => {
        agent
            .post('/login')
            .send({ 
                email: testEmail,
                password: testPassword 
            })
            .end((err) => {
                if (err) return done(err);

                agent
                    .get('/settings')
                    .expect(200)
                    .end((err, res) => {
                        if (err) return done(err);
                        expect(res.text).to.include('Settings');
                        
                        done();
                    });
            });
    });

    // Test for returning an error if new passwords do not match
    it('should return an error if new passwords do not match', async () => {
        await agent.post('/login').send({ email: testEmail, password: testPassword });

        const res = await agent.post('/settings/password')
            .send({
                currentPassword: testPassword,
                newPassword: 'newpassword123',
                confirmPassword: 'differentpassword123'
            });

        expect(res.status).to.equal(400);
    });

    // Test for returning an error if the current password is incorrect
    it('should return an error if the current password is incorrect', async () => {
        await agent
                .post('/login')
                .send({ 
                    email: testEmail,
                    password: testPassword 
                });

        const res = await agent.post('/settings/password')
            .send({
                currentPassword: 'wrongpassword',
                newPassword: 'newpassword123',
                confirmPassword: 'newpassword123'
            });

        expect(res.status).to.equal(400);
        
    });
 
    // Test for updating the user's username and redirecting to the home page
    it('should update the user\'s username and redirect to the home page', (done) => {
        agent
          .post('/login')
          .send({ 
            email: testEmail, 
            password: testPassword 
            })
          .end((err) => {
            if (err) return done(err);
      
            // Prepare new username
            const newUsername = 'updatedUsername';

            agent
              .post('/settings/username')
              .send({ username: newUsername })
              .expect(302) 
              .end((err, res) => {
                if (err) return done(err);
                expect(res.header.location).to.equal('/home'); 
                done();
              });
          });
      });
   
});
