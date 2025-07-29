# Database Configuration

This application uses PostgreSQL for persistent storage. The database connection is configured to automatically use the appropriate URL based on the environment.

## Environment Detection

The app automatically determines which database URL to use:

- **Production (Railway)**: Uses the local `DATABASE_URL` environment variable automatically provided by Railway
- **Development (Local)**: Uses the `DATABASE_PUBLIC_URL` from your `.env` file

## Setup Instructions

### For Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the `DATABASE_PUBLIC_URL` in your `.env` file with your database's public URL:
   ```
   DATABASE_PUBLIC_URL=postgresql://user:password@host:port/database
   ```

3. The app will automatically use this URL when running locally.

### For Production (Railway)

No configuration needed! Railway automatically provides the `DATABASE_URL` environment variable, and the app will use the local database connection for better performance.

## Security Notes

- Never commit `.env` files to version control
- The `.env` file is already included in `.gitignore`
- Use `.env.example` as a template for other developers
- Database URLs contain sensitive credentials and should be kept secret

## Connection Details

- **SSL**: Always enabled for security
- **Connection Pooling**: Managed automatically
- **Error Handling**: The app will show clear error messages if the database connection fails