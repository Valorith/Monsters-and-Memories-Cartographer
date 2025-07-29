import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create tables
    const queries = [
      // Maps table
      `CREATE TABLE IF NOT EXISTS maps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        image_url TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        display_order INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // POIs table
      `CREATE TABLE IF NOT EXISTS pois (
        id SERIAL PRIMARY KEY,
        map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        icon VARCHAR(50) DEFAULT '📍',
        icon_size INTEGER DEFAULT 24,
        label_visible BOOLEAN DEFAULT true,
        label_position VARCHAR(10) DEFAULT 'bottom',
        custom_icon VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Connections table
      `CREATE TABLE IF NOT EXISTS connections (
        id SERIAL PRIMARY KEY,
        from_poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
        to_poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
        bidirectional BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_poi_id, to_poi_id)
      )`,

      // Point Connectors table
      `CREATE TABLE IF NOT EXISTS point_connectors (
        id SERIAL PRIMARY KEY,
        map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE,
        name VARCHAR(255),
        from_x INTEGER NOT NULL,
        from_y INTEGER NOT NULL,
        to_x INTEGER NOT NULL,
        to_y INTEGER NOT NULL,
        from_icon VARCHAR(10) DEFAULT '🔵',
        to_icon VARCHAR(10) DEFAULT '🔵',
        from_icon_size INTEGER DEFAULT 20,
        to_icon_size INTEGER DEFAULT 20,
        from_label_visible BOOLEAN DEFAULT true,
        to_label_visible BOOLEAN DEFAULT true,
        from_label_position VARCHAR(10) DEFAULT 'bottom',
        to_label_position VARCHAR(10) DEFAULT 'bottom',
        from_icon_visible BOOLEAN DEFAULT true,
        to_icon_visible BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Zone Connectors table
      `CREATE TABLE IF NOT EXISTS zone_connectors (
        id SERIAL PRIMARY KEY,
        from_map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE,
        to_map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE,
        from_x INTEGER NOT NULL,
        from_y INTEGER NOT NULL,
        to_x INTEGER NOT NULL,
        to_y INTEGER NOT NULL,
        from_icon VARCHAR(10) DEFAULT '🟩',
        to_icon VARCHAR(10) DEFAULT '🟩',
        from_icon_size INTEGER DEFAULT 30,
        to_icon_size INTEGER DEFAULT 30,
        from_label VARCHAR(255),
        to_label VARCHAR(255),
        from_label_visible BOOLEAN DEFAULT true,
        to_label_visible BOOLEAN DEFAULT true,
        from_label_position VARCHAR(10) DEFAULT 'bottom',
        to_label_position VARCHAR(10) DEFAULT 'bottom',
        from_icon_visible BOOLEAN DEFAULT true,
        to_icon_visible BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    // Create indexes
    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS idx_pois_map_id ON pois(map_id)`,
      `CREATE INDEX IF NOT EXISTS idx_connections_from_poi ON connections(from_poi_id)`,
      `CREATE INDEX IF NOT EXISTS idx_connections_to_poi ON connections(to_poi_id)`,
      `CREATE INDEX IF NOT EXISTS idx_point_connectors_map_id ON point_connectors(map_id)`,
      `CREATE INDEX IF NOT EXISTS idx_zone_connectors_from_map ON zone_connectors(from_map_id)`,
      `CREATE INDEX IF NOT EXISTS idx_zone_connectors_to_map ON zone_connectors(to_map_id)`
    ];

    // Create update trigger function
    const triggerFunction = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `;

    // Create triggers
    const triggerQueries = [
      `DROP TRIGGER IF EXISTS update_maps_updated_at ON maps`,
      `CREATE TRIGGER update_maps_updated_at BEFORE UPDATE ON maps
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      
      `DROP TRIGGER IF EXISTS update_pois_updated_at ON pois`,
      `CREATE TRIGGER update_pois_updated_at BEFORE UPDATE ON pois
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      
      `DROP TRIGGER IF EXISTS update_connections_updated_at ON connections`,
      `CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON connections
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      
      `DROP TRIGGER IF EXISTS update_point_connectors_updated_at ON point_connectors`,
      `CREATE TRIGGER update_point_connectors_updated_at BEFORE UPDATE ON point_connectors
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      
      `DROP TRIGGER IF EXISTS update_zone_connectors_updated_at ON zone_connectors`,
      `CREATE TRIGGER update_zone_connectors_updated_at BEFORE UPDATE ON zone_connectors
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
    ];

    // Execute all queries
    console.log('Creating tables...');
    for (const query of queries) {
      await client.query(query);
    }

    console.log('Creating indexes...');
    for (const query of indexQueries) {
      await client.query(query);
    }

    console.log('Creating trigger function...');
    await client.query(triggerFunction);

    console.log('Creating triggers...');
    for (const query of triggerQueries) {
      await client.query(query);
    }

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('\nCreated tables:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

    console.log('\nMigration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();