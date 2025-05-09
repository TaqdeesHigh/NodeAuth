const fs = require('fs');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function setupDatabase() {
  console.log('🔄 Setting up database from environment variables...');

  const {
    DB_HOST,
    DB_PORT = 26150,
    DB_USER,
    DB_PASSWORD,
    DB_NAME
  } = process.env;
  
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error('❌ Error: Missing required database environment variables.');
    console.error('Please ensure your .env file contains DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME.');
    process.exit(1);
  }
  
  try {
    const rootConnection = await mysql.createConnection({
      host: DB_HOST,
      port: parseInt(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD
    });
    
    console.log('✅ Connected to MySQL server');
    
    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`);
    console.log(`✅ Database '${DB_NAME}' created or already exists`);
    
    await rootConnection.end();

    const dbConnection = await mysql.createConnection({
      host: DB_HOST,
      port: parseInt(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME
    });
    
    console.log(`✅ Connected to '${DB_NAME}' database`);

    console.log('🔄 Creating tables...');

    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Verification tokens table created');

    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Password reset tokens table created');

    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        status ENUM('success', 'failed') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Login logs table created');
    
    await dbConnection.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await dbConnection.query(`CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token)`);
    await dbConnection.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)`);
    console.log('✅ Performance indexes created');
    
    console.log('\n✅ Database setup completed successfully!');
    
    await dbConnection.end();
    
    return true;
  } catch (error) {
    console.error(`❌ Database setup error: ${error.message}`);
    console.error(error);
    return false;
  }
}

const createPool = () => {
  return mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
};

module.exports = {
  setupDatabase,
  createPool
};