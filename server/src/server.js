require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server. Could not connect to MySQL.');
    console.error(err.message);
    console.error('   Check server/.env DB_HOST/DB_USER/DB_PASSWORD/DB_NAME and that MySQL is running.');
    process.exit(1);
  }
})();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
