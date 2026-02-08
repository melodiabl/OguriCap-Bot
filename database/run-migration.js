const fs = require('fs');
const path = require('path');
const db = require('../lib/database');
const logger = require('../lib/log-manager');

async function runMigration() {
    const migrationPath = path.join(__dirname, 'migrations/001_create_notifications_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    try {
        logger.info('Iniciando migración de base de datos...');
        await db.query(sql);
        logger.info('Migración completada con éxito.');
        process.exit(0);
    } catch (error) {
        logger.error('Error durante la migración:', error);
        process.exit(1);
    }
}

runMigration();
