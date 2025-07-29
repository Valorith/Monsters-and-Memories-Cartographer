# Deployment Guide

This guide explains how to deploy the MMC app securely.

## Security Configuration

### Setting Up Admin Password

The admin password is stored as a SHA-256 hash to prevent exposing it in the source code.

#### Option 1: Using Environment Variables (Recommended)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Generate a hash for your password:
   - Open your browser's developer console
   - Run this command (replace `your_secure_password` with your actual password):
   ```javascript
   await crypto.subtle.digest('SHA-256', new TextEncoder().encode('your_secure_password')).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
   ```
   - Copy the resulting hash

3. Edit `.env` and replace the hash:
   ```
   VITE_ADMIN_PASSWORD_HASH=your_generated_hash_here
   ```

4. **Important**: Never commit the `.env` file to Git! It's already in `.gitignore`.

#### Option 2: Using GitHub Pages with GitHub Secrets

If deploying to GitHub Pages:

1. Go to your repository's Settings > Secrets and variables > Actions
2. Add a new secret called `VITE_ADMIN_PASSWORD_HASH` with your generated hash
3. Update your GitHub Actions workflow to inject the secret during build

Example workflow file (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      env:
        VITE_ADMIN_PASSWORD_HASH: ${{ secrets.VITE_ADMIN_PASSWORD_HASH }}
        
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

#### Option 3: Using Netlify/Vercel

Both platforms support environment variables:

**Netlify:**
1. Go to Site settings > Environment variables
2. Add `VITE_ADMIN_PASSWORD_HASH` with your hash

**Vercel:**
1. Go to Project Settings > Environment Variables
2. Add `VITE_ADMIN_PASSWORD_HASH` with your hash

### Default Password Warning

If no environment variable is set, the app falls back to a default hash for the password `admin123`. **NEVER use this in production!**

## Building for Production

```bash
# Install dependencies
npm install

# Build the app
npm run build

# Preview the build locally
npm run preview
```

## Deployment Options

### GitHub Pages

1. Install gh-pages:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Add to `package.json`:
   ```json
   {
     "scripts": {
       "deploy": "npm run build && gh-pages -d dist"
     }
   }
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

### Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your project directory
3. Follow the prompts
4. Add environment variables in Vercel dashboard

## Security Best Practices

1. **Always use a strong, unique password** for admin access
2. **Never commit `.env` files** to version control
3. **Use environment variables** for sensitive configuration
4. **Consider implementing server-side authentication** for production use
5. **Regularly update** the admin password hash

## Testing Admin Access

After deployment, test admin access:

1. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
2. Enter your password when prompted
3. Verify admin features are working

## Troubleshooting

### Admin password not working

1. Check that environment variable is set correctly
2. Verify the hash was generated correctly
3. Check browser console for errors

### Environment variables not loading

1. Make sure variable name starts with `VITE_`
2. Restart the dev server after changing `.env`
3. Clear browser cache and reload