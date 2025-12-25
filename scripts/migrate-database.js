#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * Handles database migrations using the custom migration system
 */

import { DataMigrationSystem } from '../lib/data-migration-system.js';
import { DatabaseAdapter } from '../lib/database-adapter.js';
import { PostgresDriver } from '../lib/postgres-driver.js';

const command = process.argv[2];
const flags = process.argv.slice(3);

async function main() {
  try {
    const dbAdapter = new DatabaseAdapter();
    const postgresDriver = new PostgresDriver();
    
    switch (command) {
      case 'migrate':
        console.log('🚀 Starting database migration...');
        const migrationSystem = new DataMigrationSystem();
        
        if (flags.includes('--dry-run')) {
          console.log('🔍 Running in dry-run mode...');
          // Add dry-run logic here
          return;
        }
        
        if (flags.includes('--force')) {
          console.log('⚠️ Running with force flag...');
        }
        
        await migrationSystem.migrate();
        break;
        
      case 'status':
        console.log('📊 Checking migration status...');
        await checkMigrationStatus(dbAdapter);
        break;
        
      case 'health':
        console.log('🏥 Checking database health...');
        await checkDatabaseHealth(postgresDriver);
        break;
        
      default:
        console.log(`
Usage: node scripts/migrate-database.js <command> [options]

Commands:
  migrate         Run database migration
  status          Check migration status
  health          Check database health

Options:
  --dry-run       Run migration in dry-run mode
  --force         Force migration even if already completed
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration script failed:', error.message);
    process.exit(1);
  }
}

async function checkMigrationStatus(dbAdapter) {
  try {
    const status = await dbAdapter.getMigrationStatus();
    console.log('Migration Status:', status);
  } catch (error) {
    console.error('Failed to check migration status:', error.message);
  }
}

async function checkDatabaseHealth(postgresDriver) {
  try {
    await postgresDriver.testConnection();
    console.log('✅ Database connection is healthy');
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
  }
}

main();