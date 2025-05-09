// controllers/authController.js
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const pool = require('../config/database');
const transporter = require('../config/email');
const { frontendUrl, emailFrom } = require('../config/server');
const { generateVerificationToken, generateResetToken, generateJWT } = require('../utils/tokenGenerator');

const register = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    // Generate verification token
    const verificationToken = generateVerificationToken();
    await pool.execute(
      'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
      [result.insertId, verificationToken]
    );

    // Send verification email
    const verificationUrl = `${frontendUrl}?action=verify-email&token=${verificationToken}`;

    await transporter.sendMail({
      from: emailFrom,
      to: email,
      subject: 'Verify Your Email',
      html: `<p>Please verify your email by clicking on this link: <a href="${verificationUrl}">${verificationUrl}</a></p>`
    });

    res.status(201).json({ 
      message: 'User registered successfully. Please check your email to verify your account.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find verification token
    const [tokens] = await pool.execute(
      'SELECT * FROM verification_tokens WHERE token = ? AND expires_at > NOW()',
      [token]
    );
    
    if (tokens.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    // Update user status
    await pool.execute(
      'UPDATE users SET email_verified = 1 WHERE id = ?',
      [tokens[0].user_id]
    );
    
    // Delete used token
    await pool.execute(
      'DELETE FROM verification_tokens WHERE token = ?',
      [token]
    );
    
    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Server error during verification' });
  }
};

const login = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    // Find user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(401).json({ error: 'Please verify your email before logging in' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = generateJWT(user);

    // Log login attempt
    await pool.execute(
      'INSERT INTO login_logs (user_id, ip_address, user_agent, status) VALUES (?, ?, ?, ?)',
      [user.id, req.ip, req.headers['user-agent'], 'success']
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

const requestPasswordReset = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.body;

    // Find user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    // Always return success even if email doesn't exist (for security)
    if (users.length === 0) {
      return res.status(200).json({ message: 'If your email exists in our system, you will receive a password reset link' });
    }

    const user = users[0];

    // Generate reset token
    const resetToken = generateResetToken();
    const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await pool.execute(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetToken, tokenExpiry]
    );

    // Send reset email
    const resetUrl = `${frontendUrl}?action=reset-password&token=${resetToken}`;

    await transporter.sendMail({
      from: emailFrom,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click this link to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>
             <p>This link will expire in 1 hour.</p>
             <p>If you didn't request this, please ignore this email.</p>`
    });

    res.status(200).json({ message: 'If your email exists in our system, you will receive a password reset link' });
  } catch (error) {
    console.error('Reset request error:', error);
    res.status(500).json({ error: 'Server error during password reset request' });
  }
};

const resetPassword = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { token, password } = req.body;

    // Find valid token
    const [tokens] = await pool.execute(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
      [token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetToken = tokens[0];

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );

    // Delete used token
    await pool.execute(
      'DELETE FROM password_reset_tokens WHERE token = ?',
      [token]
    );

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error during password reset' });
  }
};

const logout = (req, res) => {
  // Simply return success - actual logout happens on client side by removing the token
  res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = {
  register,
  verifyEmail,
  login,
  requestPasswordReset,
  resetPassword,
  logout
};