/**
 * Automatic Setup System
 * 
 * Ensures PostgreSQL is available and ready before the bot starts.
 * Runs completely automatically without user intervention.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import chalk from 'chalk';

class AutoSetup {
  constructor() {
    this.isWindows = process.platform === 'win32';
    this.setupComplete = false;
  }

  /**
   * Run complete automatic setup
   */
  async run() {
    try {
      console.log(chalk.cyan('🤖 AUTOMATIC: Running auto-setup system...'));
      
      // Check if setup is needed
      if (await this.isSetupComplete()) {
        console.log(chalk.green('🤖 AUTOMATIC: Setup already complete, skipping...'));
        return true;
      }
      
      // Run automatic setup steps
      await this.ensureDirectories();
      await this.ensurePostgreSQL();
      
      this.setupComplete = true;
      console.log(chalk.green('🤖 AUTOMATIC: Auto-setup completed successfully'));
      return true;
      
    } catch (error) {
      console.log(chalk.yellow(`🤖 AUTOMATIC: Auto-setup failed (will use fallback): ${error.message}`));
      return false;
    }
  }

  /**
   * Check if setup is already complete
   */
  async isSetupComplete() {
    try {
      // Check if PostgreSQL is responding
      const result = this.execCommand('docker-compose ps postgres', { silent: true });
      return result.includes('Up');
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    console.log(chalk.cyan('🤖 AUTOMATIC: Creating required directories...'));
    
    const dirs = [
      'database/backups',
      'database/init',
      'logs',
      'storage',
      'tmp'
    ];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist, ignore
      }
    }
    
    console.log(chalk.green('🤖 AUTOMATIC: Directories created'));
  }

  /**
   * Ensure PostgreSQL is running
   */
  async ensurePostgreSQL() {
    console.log(chalk.cyan('🤖 AUTOMATIC: Ensuring PostgreSQL is available...'));
    
    try {
      // Check if Docker is available
      this.execCommand('docker --version', { silent: true });
      this.execCommand('docker-compose --version', { silent: true });
      
      // Check if PostgreSQL container exists and is running
      const psResult = this.execCommand('docker-compose ps postgres', { silent: true });
      
      if (!psResult.includes('Up')) {
        console.log(chalk.cyan('🤖 AUTOMATIC: Starting PostgreSQL container...'));
        
        // Start PostgreSQL container
        this.execCommand('docker-compose up -d postgres', { silent: false });
        
        // Wait for PostgreSQL to be ready
        console.log(chalk.cyan('🤖 AUTOMATIC: Waiting for PostgreSQL to be ready...'));
        await this.waitForPostgreSQL();
      }
      
      console.log(chalk.green('🤖 AUTOMATIC: PostgreSQL is ready'));
      
    } catch (error) {
      console.log(chalk.yellow(`🤖 AUTOMATIC: PostgreSQL setup failed: ${error.message}`));
      console.log(chalk.yellow('🤖 AUTOMATIC: Will use LowDB fallback mode'));
      throw error;
    }
  }

  /**
   * Wait for PostgreSQL to be ready
   */
  async waitForPostgreSQL(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = this.execCommand('docker-compose exec -T postgres pg_isready -U bot_user -d oguribot', { silent: true });
        if (result.includes('accepting connections')) {
          return true;
        }
      } catch (error) {
        // Still starting up
      }
      
      // Wait 2 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (i % 5 === 0) {
        console.log(chalk.cyan(`🤖 AUTOMATIC: Waiting for PostgreSQL... (${i + 1}/${maxAttempts})`));
      }
    }
    
    throw new Error('PostgreSQL failed to start within timeout');
  }

  /**
   * Execute command with proper error handling
   */
  execCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        timeout: 30000, // 30 second timeout
      });
      return result;
    } catch (error) {
      if (!options.silent) {
        console.error(chalk.red(`🤖 AUTOMATIC: Command failed: ${command}`));
        console.error(chalk.red(`🤖 AUTOMATIC: Error: ${error.message}`));
      }
      throw error;
    }
  }
}

// Export singleton instance
const autoSetup = new AutoSetup();

/**
 * Run automatic setup - called from index.js
 */
export async function runAutoSetup() {
  return await autoSetup.run();
}

export default autoSetup;