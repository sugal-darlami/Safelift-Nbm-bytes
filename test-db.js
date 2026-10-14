const db = require('./db');

async function testConnection() {
    try {
        const [rows] = await db.query('SELECT 1 AS connected');
        console.log('Database connected:', rows);
    } catch (error) {
        console.error('Connection failed:', error.message);
    } finally {
        await db.end();
    }
}

testConnection();