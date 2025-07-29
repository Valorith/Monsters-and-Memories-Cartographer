# Railway CLI Setup Guide

## Installation on Windows

### Method 1: Using npm (Recommended)
1. Open Command Prompt or PowerShell as Administrator
2. Run:
   ```bash
   npm install -g @railway/cli
   ```

### Method 2: Using the Windows installer
1. Download the installer from: https://github.com/railwayapp/cli/releases/latest
2. Look for `railway-v3.x.x-x86_64-pc-windows-msvc.exe`
3. Download and run the installer

### Method 3: Using PowerShell script
1. Open PowerShell as Administrator
2. Run:
   ```powershell
   iwr -useb https://raw.githubusercontent.com/railwayapp/cli/master/scripts/install.ps1 | iex
   ```

## Configuration

After installation, follow these steps:

### 1. Login to Railway
Open a new terminal and run:
```bash
railway login
```
This will open your browser to authenticate.

### 2. Link your project
Navigate to your project directory:
```bash
cd "C:\Users\rgagn\OneDrive\Documents\GitHub Projects\MMC"
```

Then link your project:
```bash
railway link
```
Select your project from the list.

### 3. Run the database migration
Now you can run the migration script:
```bash
railway run node run-migration.js
```

## Verify Installation
To verify Railway CLI is installed correctly:
```bash
railway --version
```

## Common Commands
- `railway login` - Login to Railway
- `railway link` - Link a project
- `railway run [command]` - Run a command with Railway environment variables
- `railway logs` - View deployment logs
- `railway status` - Check deployment status
- `railway variables` - List environment variables

## Troubleshooting

### If railway command is not found:
1. Restart your terminal after installation
2. Check if it's in your PATH:
   - Windows: Check System Environment Variables
   - Add Railway installation directory to PATH if needed

### If you get permission errors:
1. Run terminal as Administrator
2. Or install locally using npm without -g flag

### For WSL users:
It's recommended to install Railway CLI in Windows rather than WSL for better compatibility.