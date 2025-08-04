# System Test POIs Setup

This directory contains a SQL script to create system test POIs for testing the POI sharing functionality.

## Setup Instructions

1. Run the SQL script to create the System user and test POIs:
   ```bash
   psql -U your_username -d your_database_name -f create-system-test-pois.sql
   ```

2. This will create:
   - A System user (ID: 999999)
   - 4 test POIs on the default map (map ID: 1)
   - All POIs share the same share code: `SYSTEST001`

## Using the Test Share Code

1. As an admin user, go to the Account page
2. Navigate to the "Custom POIs" tab
3. Click "Add Shared POI"
4. Click the "🧪 Insert System Test Code" button (only visible to admins)
5. This will insert the share code `SYSTEST001`
6. Click "Add POI" to add all test POIs to your account

## Test POIs Created

### Shared POI (accessible via share code)
- **System Test Location** - Located at (650, 650) - This is the main test POI with share code `SYSTEST001`

### Private POIs (not shared, only visible to System user)
- **Private Test Dungeon** - Located at (500, 500)
- **Private Test Merchant** - Located at (600, 600)

The shared POI demonstrates the sharing functionality. When you use the share code, only the "System Test Location" POI will be added to your account. The private POIs remain visible only to the System user.

## Notes

- The share code `SYSTEST001` is hardcoded in the account.html file
- Only admins can see and use the test button
- The System user ID (999999) is chosen to avoid conflicts with regular users
- Test POIs are placed on the default map (ID: 1) in a diagonal pattern for easy identification