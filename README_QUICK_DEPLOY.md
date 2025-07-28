# Quick Deployment Guide

## Setting Up Admin Password (Temporary Solution)

This app uses a simple password stored in environment variables. This is temporary until Google OAuth is implemented.

### For Local Development

1. The `.env` file is already created with a default password
2. **Change the password** in `.env`:
   ```
   VITE_ADMIN_PASSWORD=your_secure_password_here
   ```
3. The `.env` file is already in `.gitignore` and won't be committed

### For GitHub Pages Deployment

1. Do NOT commit any `.env` files
2. In your GitHub repository:
   - Go to Settings → Secrets and variables → Actions
   - Add a new secret: `VITE_ADMIN_PASSWORD`
   - Set your secure password as the value

3. Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run build
      env:
        VITE_ADMIN_PASSWORD: ${{ secrets.VITE_ADMIN_PASSWORD }}
    - uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

### For Netlify

1. Push your code to GitHub (without .env)
2. In Netlify dashboard:
   - Go to Site settings → Environment variables
   - Add variable: `VITE_ADMIN_PASSWORD`
   - Set your password

### For Vercel

1. Push your code to GitHub (without .env)
2. In Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add: `VITE_ADMIN_PASSWORD`
   - Set your password

## Important Security Notes

⚠️ **This is a temporary solution!**
- The password is checked client-side (not secure for production)
- Anyone can see the password check in the browser's developer tools
- This is only meant as a quick solution until proper authentication is implemented
- Perfect for personal projects or internal tools, not for public production use

## Testing

1. Deploy your app
2. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
3. Enter your password
4. You should see "Admin mode activated"

## Next Steps

When ready to implement proper authentication:
1. Set up Google OAuth
2. Remove the password-based admin check
3. Use proper server-side authentication