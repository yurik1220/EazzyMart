# Database Module

This directory contains database configuration, schema, and migration scripts for the EazzyMart backend.

## Files

### Configuration
- **`db-config.js`** - Database connection module supporting both SQLite and PostgreSQL

### Schema
- **`postgres-schema.sql`** - PostgreSQL schema definition
- **`migrations/`** - SQL migration files (if using traditional migrations)

### Migration Scripts
- **`backup-sqlite.js`** - Backup SQLite database to JSON files
- **`migrate-to-postgres.js`** - Migrate data from SQLite to PostgreSQL
- **`compare-databases.js`** - Compare data between SQLite and PostgreSQL

## Quick Reference

### NPM Scripts

```bash
# Backup SQLite database
npm run db:backup

# Migrate to PostgreSQL
npm run db:migrate

# Compare databases
npm run db:compare

# Test PostgreSQL connection
npm run db:test-pg
```

### Direct Execution

```bash
# Backup
node database/backup-sqlite.js

# Migrate
node database/migrate-to-postgres.js

# Compare
node database/compare-databases.js
```

## Database Configuration Module

The `db-config.js` module provides a unified API for both SQLite and PostgreSQL:

```javascript
const { initDatabase, getDatabase, isPostgres } = require('./database/db-config');

// Initialize database (reads DB_TYPE from .env)
const db = await initDatabase();

// Use the database (same API for both SQLite and PostgreSQL)
const items = await db.all('SELECT * FROM items');
const item = await db.get('SELECT * FROM items WHERE id = ?', [1]);
await db.run('INSERT INTO items (name) VALUES (?)', ['Item Name']);

// Check database type
if (isPostgres()) {
  console.log('Using PostgreSQL');
} else {
  console.log('Using SQLite');
}
```

## Environment Variables

```env
# Database Type
DB_TYPE=sqlite          # or 'postgres'

# PostgreSQL (Neon)
DATABASE_URL=postgresql://...
DB_SSL=true

# SQLite
SQLITE_DB_PATH=grocery.db
```

## Migration Process

1. **Backup Current Data**
   ```bash
   npm run db:backup
   ```
   Creates backup in `backups/backup-YYYY-MM-DD/`

2. **Configure PostgreSQL**
   Add `DATABASE_URL` to `.env` (keep `DB_TYPE=sqlite`)

3. **Test Connection**
   ```bash
   npm run db:test-pg
   ```

4. **Run Migration**
   ```bash
   npm run db:migrate
   ```

5. **Verify Migration**
   ```bash
   npm run db:compare
   ```

6. **Switch to PostgreSQL**
   Update `.env`: `DB_TYPE=postgres`

7. **Test Application**
   Start server and test all endpoints

## Database Wrapper API

The database wrapper provides consistent methods:

### Query Methods

```javascript
// Run a query (INSERT, UPDATE, DELETE)
const result = await db.run(sql, params);
// Returns: { changes: number, lastID: number }

// Get single row
const row = await db.get(sql, params);
// Returns: object or null

// Get all rows
const rows = await db.all(sql, params);
// Returns: array of objects

// Execute multiple statements
await db.exec(multiStatementSQL);

// Raw query (PostgreSQL only)
const result = await db.query(sql, params);
```

### Utility Methods

```javascript
// Get database type
const type = db.getType();  // 'sqlite' or 'postgres'

// Get raw connection
const rawDb = db.getRawConnection();

// Close connection
await db.close();
```

## SQL Conversion

The module automatically converts some SQL differences:

### Placeholders
- SQLite: `?` → PostgreSQL: `$1, $2, $3...`

### Date/Time Functions
- `datetime('now')` → `CURRENT_TIMESTAMP`
- `date('now')` → `CURRENT_DATE`

### Auto-increment
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`

### Boolean Values
- SQLite: `0`/`1` → PostgreSQL: `FALSE`/`TRUE`

## Schema Management

### PostgreSQL Schema

The PostgreSQL schema is defined in `postgres-schema.sql` and includes:
- All tables from SQLite
- Proper data types (NUMERIC for prices, BOOLEAN for flags)
- Foreign key constraints
- Indexes for performance
- Triggers for automatic `updated_at` timestamps

### Adding New Tables

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS new_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT
);
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS new_table (
  id SERIAL PRIMARY KEY,
  name TEXT
);
```

Update both in your code and in `postgres-schema.sql`.

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to PostgreSQL  
**Solution:** 
- Verify `DATABASE_URL` is correct
- Check `DB_SSL=true` is set
- Ensure Neon database is active

### Migration Errors

**Problem:** "duplicate key value"  
**Solution:** Data already exists; migration uses `ON CONFLICT DO NOTHING`

**Problem:** "column does not exist"  
**Solution:** Schema mismatch; verify `postgres-schema.sql` is up to date

### Performance Issues

**Problem:** Slow queries  
**Solution:**
- Add indexes for frequently queried columns
- Use connection pooling (automatically configured)
- Monitor slow queries in Neon dashboard

## Best Practices

1. **Always backup before migration**
2. **Test on development database first**
3. **Use environment variables for configuration**
4. **Monitor database performance**
5. **Keep schema files in sync**
6. **Use transactions for batch operations**
7. **Index frequently queried columns**

## Further Reading

- [Neon PostgreSQL Documentation](https://neon.tech/docs)
- [Node.js PostgreSQL (pg) Guide](https://node-postgres.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [SQL Best Practices](https://www.postgresql.org/docs/current/sql.html)

## Support

For migration help, see:
- [`MIGRATION_QUICK_START.md`](../MIGRATION_QUICK_START.md) - Quick 5-step guide
- [`NEON_MIGRATION_GUIDE.md`](../NEON_MIGRATION_GUIDE.md) - Comprehensive guide

