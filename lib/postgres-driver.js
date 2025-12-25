/**
 * PostgreSQL Driver
 * 
 * Handles all PostgreSQL database operations with connection pooling,
 * transaction support, and JSONB operations for the WhatsApp bot system.
 */

import pkg from 'pg';
const { Pool, Client } = pkg;
import EventEmitter from 'events';

class PostgreSQLDriver extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      host: config.host || process.env.POSTGRES_HOST || 'localhost',
      port: config.port || process.env.POSTGRES_PORT || 5432,
      database: config.database || process.env.POSTGRES_DB || 'oguribot',
      user: config.user || process.env.POSTGRES_USER || 'bot_user',
      password: config.password || process.env.POSTGRES_PASSWORD || 'secure_bot_password_2024',
      ssl: config.ssl || process.env.POSTGRES_SSL === 'true',
      max: config.max || 20, // Maximum number of connections
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
      statement_timeout: 30000, // 30 seconds
      query_timeout: 30000,
    };

    this.pool = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    
    // Statistics
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      activeConnections: 0,
      totalConnections: 0,
    };
  }

  /**
   * Establish connection to PostgreSQL
   */
  async connect() {
    try {
      console.log('🔄 Connecting to PostgreSQL...');
      console.log(`📍 Host: ${this.config.host}:${this.config.port}`);
      console.log(`📊 Database: ${this.config.database}`);
      console.log(`👤 User: ${this.config.user}`);
      
      // Create connection pool
      this.pool = new Pool(this.config);
      
      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      client.release();
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      console.log('✅ PostgreSQL connected successfully');
      console.log(`⏰ Server time: ${result.rows[0].current_time}`);
      console.log(`🐘 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
      
      // Set up pool event listeners
      this.setupPoolEventListeners();
      
      this.emit('connected');
      return true;
      
    } catch (error) {
      this.isConnected = false;
      this.connectionAttempts++;
      
      console.error('❌ PostgreSQL connection failed:', error.message);
      
      // Enhanced error reporting
      if (error.code === 'ECONNREFUSED') {
        console.error('💡 Tip: Make sure PostgreSQL is running and accessible');
        console.error('💡 Check: docker-compose up postgres');
      } else if (error.code === '28P01') {
        console.error('💡 Tip: Check username and password in environment variables');
      } else if (error.code === '3D000') {
        console.error('💡 Tip: Database does not exist, check POSTGRES_DB');
      }
      
      this.emit('connection_error', error);
      throw error;
    }
  }

  /**
   * Set up pool event listeners for monitoring
   */
  setupPoolEventListeners() {
    this.pool.on('connect', (client) => {
      this.stats.totalConnections++;
      this.stats.activeConnections++;
      console.log(`🔗 New PostgreSQL connection established (Active: ${this.stats.activeConnections})`);
    });

    this.pool.on('remove', (client) => {
      this.stats.activeConnections--;
      console.log(`🔌 PostgreSQL connection removed (Active: ${this.stats.activeConnections})`);
    });

    this.pool.on('error', (err, client) => {
      console.error('❌ PostgreSQL pool error:', err.message);
      this.emit('pool_error', err);
    });
  }

  /**
   * Execute SQL query with parameters
   */
  async query(sql, params = []) {
    if (!this.isConnected || !this.pool) {
      throw new Error('PostgreSQL not connected');
    }

    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      console.log(`🔍 Executing query: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
      if (params.length > 0) {
        console.log(`📝 Parameters: ${JSON.stringify(params).substring(0, 200)}`);
      }

      const result = await this.pool.query(sql, params);
      const duration = Date.now() - startTime;
      
      this.stats.successfulQueries++;
      
      console.log(`✅ Query executed successfully (${duration}ms, ${result.rowCount} rows)`);
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`🐌 Slow query detected (${duration}ms): ${sql.substring(0, 100)}`);
      }
      
      return result.rows;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.stats.failedQueries++;
      
      console.error(`❌ Query failed (${duration}ms):`, error.message);
      console.error(`📝 SQL: ${sql}`);
      console.error(`📝 Params: ${JSON.stringify(params)}`);
      
      // Enhanced error handling
      if (error.code === '23505') {
        console.error('💡 Duplicate key violation - record already exists');
      } else if (error.code === '23503') {
        console.error('💡 Foreign key violation - referenced record does not exist');
      } else if (error.code === '42P01') {
        console.error('💡 Table does not exist - check database schema');
      }
      
      this.emit('query_error', error, sql, params);
      throw error;
    }
  }

  /**
   * Execute transaction with multiple queries
   */
  async transaction(callback) {
    if (!this.isConnected || !this.pool) {
      throw new Error('PostgreSQL not connected');
    }

    const client = await this.pool.connect();
    
    try {
      console.log('🔄 Starting transaction...');
      await client.query('BEGIN');
      
      // Create a transaction-specific query function
      const transactionQuery = async (sql, params = []) => {
        console.log(`🔍 [TX] Executing: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
        const result = await client.query(sql, params);
        console.log(`✅ [TX] Query executed (${result.rowCount} rows)`);
        return result.rows;
      };
      
      // Execute callback with transaction query function
      const result = await callback(transactionQuery);
      
      await client.query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Transaction rolled back:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Query JSONB data with path and value
   */
  async jsonQuery(table, jsonColumn, jsonPath, value) {
    const sql = `SELECT * FROM ${table} WHERE ${jsonColumn}->>'${jsonPath}' = $1`;
    return await this.query(sql, [value]);
  }

  /**
   * Update JSONB field
   */
  async updateJsonField(table, whereColumn, whereValue, jsonColumn, jsonPath, newValue) {
    const sql = `
      UPDATE ${table} 
      SET ${jsonColumn} = jsonb_set(${jsonColumn}, '{${jsonPath}}', $1::jsonb, true),
          updated_at = CURRENT_TIMESTAMP
      WHERE ${whereColumn} = $2
      RETURNING *
    `;
    return await this.query(sql, [JSON.stringify(newValue), whereValue]);
  }

  /**
   * Full-text search in specified columns
   */
  async fullTextSearch(table, searchColumns, searchTerm, limit = 50) {
    const columnList = Array.isArray(searchColumns) ? searchColumns.join(" || ' ' || ") : searchColumns;
    const sql = `
      SELECT *, ts_rank(to_tsvector('spanish', ${columnList}), plainto_tsquery('spanish', $1)) as rank
      FROM ${table}
      WHERE to_tsvector('spanish', ${columnList}) @@ plainto_tsquery('spanish', $1)
      ORDER BY rank DESC
      LIMIT $2
    `;
    return await this.query(sql, [searchTerm, limit]);
  }

  /**
   * Bulk insert with conflict resolution
   */
  async bulkInsert(table, columns, rows, conflictColumn = null, updateColumns = []) {
    if (!rows || rows.length === 0) return [];

    const columnList = columns.join(', ');
    const valuesList = rows.map((_, index) => {
      const start = index * columns.length + 1;
      const params = columns.map((_, colIndex) => `$${start + colIndex}`).join(', ');
      return `(${params})`;
    }).join(', ');

    let sql = `INSERT INTO ${table} (${columnList}) VALUES ${valuesList}`;
    
    // Add conflict resolution if specified
    if (conflictColumn && updateColumns.length > 0) {
      const updateList = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
      sql += ` ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updateList}, updated_at = CURRENT_TIMESTAMP`;
    } else if (conflictColumn) {
      sql += ` ON CONFLICT (${conflictColumn}) DO NOTHING`;
    }
    
    sql += ' RETURNING *';

    // Flatten all row values into a single parameter array
    const params = rows.flat();
    
    return await this.query(sql, params);
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    const queries = [
      // Table sizes
      `SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE schemaname = 'public'`,
      
      // Connection info
      `SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()`,
      
      // Database size
      `SELECT pg_size_pretty(pg_database_size(current_database())) as database_size`
    ];

    const results = await Promise.all(queries.map(sql => this.query(sql)));
    
    return {
      tableStats: results[0],
      connectionStats: results[1][0],
      databaseSize: results[2][0].database_size,
      driverStats: this.stats
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health_check, NOW() as timestamp');
      return {
        healthy: true,
        timestamp: result[0].timestamp,
        connectionPool: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        connectionPool: null
      };
    }
  }

  /**
   * Close all connections
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.end();
        console.log('✅ PostgreSQL connection pool closed');
      }
      this.isConnected = false;
      this.emit('disconnected');
    } catch (error) {
      console.error('❌ Error closing PostgreSQL pool:', error.message);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      config: {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        maxConnections: this.config.max
      },
      pool: this.pool ? {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      } : null,
      stats: this.stats
    };
  }
}

export { PostgreSQLDriver };