# Avatar System Documentation

## Overview

The MMC avatar system allows users to upload custom profile pictures. Avatars are stored as files on the server's filesystem with references in the database.

## Environment-Aware Storage

To support sharing a database between development and production environments, avatar filenames include an environment prefix:

- **Development**: `dev_<userId>_<timestamp>.<ext>` (e.g., `dev_1_1753895163716.jpg`)
- **Production**: `prod_<userId>_<timestamp>.<ext>` (e.g., `prod_1_1753895163716.jpg`)

This prevents conflicts when the same database is used in multiple environments.

## File Naming Convention

```
<environment>_<userId>_<timestamp>.<extension>

Where:
- environment: "dev" or "prod" based on NODE_ENV
- userId: The user's database ID
- timestamp: Unix timestamp in milliseconds
- extension: jpg, png, gif, or webp
```

## Automatic Features

### 1. Format Detection
- Automatically detects and corrects file extension mismatches
- Checks for files with different extensions when the primary lookup fails

### 2. Environment Handling
- Tracks missing file counts separately for dev and prod environments
- Won't delete avatars from one environment when accessed from another
- Keeps the latest avatar from each environment during cleanup

### 3. Self-Healing
- Auto-corrects database when actual file differs from stored filename
- Handles legacy files without environment prefixes
- Migrates old format files to new format automatically

### 4. Rate Limiting
- 5-second cooldown between avatar uploads per user
- Prevents rapid-fire uploads that could cause race conditions

## Cleanup Process

The cleanup process runs every 24 hours and:
1. Removes orphaned files not referenced in the database
2. Keeps the current avatar for each user
3. Keeps the latest avatar from each environment
4. Removes older versions within the same environment

## Migration

To migrate existing avatars to the new naming convention:

```bash
node src/utils/migrate-avatar-prefixes.js
```

This will:
1. Rename existing avatar files to include the current environment prefix
2. Update database references to match the new filenames

## Troubleshooting

### Avatar Not Found
If an avatar exists but isn't loading:
1. Check if the file exists with a different environment prefix
2. Use the fix-mismatch endpoint: `POST /api/user/profile/avatar/fix-mismatch`
3. Check server logs for `[AVATAR]` prefixed messages

### Shared Database Issues
When using the same database for dev and prod:
1. Avatars uploaded in one environment won't be visible in the other (by design)
2. Consider using separate databases or cloud storage for a unified experience
3. The system will gracefully fall back to Google avatars when files aren't found

### File Permissions
Ensure the `public/avatars` directory:
1. Exists and is writable by the server process
2. Has proper permissions (typically 755)
3. Is included in your deployment but its contents are gitignored