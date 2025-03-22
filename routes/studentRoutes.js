const express = require('express');
const Student = require('../model/student');

const router = express.Router();

// Create Student
router.post('/students', async (req, res) => {
    try {
        const { name, email, password, phone, gender, educationLevel } = req.body;

        const newStudent = new Student({
            name,
            email,
            password,
            phone,
            gender,
            educationLevel,
        });

        await newStudent.save();
        res.status(201).json({ message: 'Student created successfully', student: newStudent });
    } catch (error) {
        res.status(500).json({ message: 'Error creating student', error: error.message });
    }
});

module.exports = router;