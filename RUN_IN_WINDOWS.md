# Running the App in Windows

You can run this app directly in Windows (not WSL). Here's how:

## Prerequisites
1. Install Node.js for Windows from https://nodejs.org/
2. Open Windows Command Prompt or PowerShell (not WSL)

## Steps to Run

1. **Navigate to the project folder in Windows:**
   ```cmd
   cd "C:\Users\rgagn\OneDrive\Documents\GitHub Projects\MMC"
   ```

2. **Install dependencies (if not already done):**
   ```cmd
   npm install
   ```

3. **Run the app:**
   
   Option A - Production mode (recommended):
   ```cmd
   npm run build
   npm run start:dev
   ```
   Then open: http://localhost:4173

   Option B - Development mode (with hot reload):
   ```cmd
   npm run dev
   ```
   Then open: http://localhost:5173

## Troubleshooting

If you get script errors on Windows, you may need to:
1. Allow PowerShell scripts: Run PowerShell as Administrator and execute:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. Or use Command Prompt instead of PowerShell

The app will work exactly the same in Windows as in WSL!