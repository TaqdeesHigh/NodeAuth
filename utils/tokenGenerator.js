// utils/tokenGenerator.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/server');

const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const generateJWT = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    jwtSecret,
    { expiresIn: '24h' }
  );
};

module.exports = {
  generateVerificationToken,
  generateResetToken,
  generateJWT
};