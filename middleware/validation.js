// middleware/validation.js
const { check } = require('express-validator');

const registerValidation = [
  check('email').isEmail().withMessage('Please provide a valid email'),
  check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  check('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
];

const loginValidation = [
  check('email').isEmail().withMessage('Please provide a valid email'),
  check('password').notEmpty().withMessage('Password is required')
];

const resetRequestValidation = [
  check('email').isEmail().withMessage('Please provide a valid email')
];

const resetPasswordValidation = [
  check('token').notEmpty().withMessage('Reset token is required'),
  check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
];

module.exports = {
  registerValidation,
  loginValidation,
  resetRequestValidation,
  resetPasswordValidation
};