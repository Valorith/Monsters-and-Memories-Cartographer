import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pg from 'pg';

const { Pool } = pg;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.APP_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [profile.id]
    );

    if (existingUser.rows.length > 0) {
      // Update last login
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [existingUser.rows[0].id]
      );
      return done(null, existingUser.rows[0]);
    }

    // Create new user
    const newUser = await pool.query(
      'INSERT INTO users (google_id, email, name, picture) VALUES ($1, $2, $3, $4) RETURNING *',
      [profile.id, profile.emails[0].value, profile.displayName, profile.photos[0].value]
    );

    // Create default preferences for new user
    await pool.query(
      'INSERT INTO user_preferences (user_id) VALUES ($1)',
      [newUser.rows[0].id]
    );

    return done(null, newUser.rows[0]);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, user.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
export { pool };