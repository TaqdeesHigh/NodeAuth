// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { 
  registerValidation, 
  loginValidation, 
  resetRequestValidation, 
  resetPasswordValidation 
} = require('../middleware/validation');

// Auth routes
router.post('/register', registerValidation, authController.register);
router.get('/verify/:token', authController.verifyEmail);
router.post('/login', loginValidation, authController.login);
router.post('/reset-request', resetRequestValidation, authController.requestPasswordReset);
router.post('/reset-password', resetPasswordValidation, authController.resetPassword);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;