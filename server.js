// server.js
const app = require('./app');
const { port } = require('./config/server');
const { setupDatabase } = require('./database');

async function startServer() {
  try {
    // Setup database first
    const dbSetupSuccess = await setupDatabase();
    
    if (!dbSetupSuccess) {
      console.error('❌ Server startup aborted due to database setup failure');
      process.exit(1);
    }
    
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
}

startServer();