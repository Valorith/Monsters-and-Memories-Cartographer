# Ko-fi Webhook Integration Setup

This guide explains how to set up Ko-fi webhook integration for the MMC app.

## Overview

The Ko-fi webhook integration allows the MMC app to:
- Automatically track donations from Ko-fi
- Match donations to users by their nickname (case-insensitive)
- Store complete donation history
- Provide admin views for donation management

## Setup Steps

### 1. Environment Configuration

Add your Ko-fi verification token to your `.env` file:

```env
KOFI_VERIFICATION_TOKEN=your-verification-token-here
```

### 2. Ko-fi Webhook Configuration

1. Log in to your Ko-fi account
2. Go to [Ko-fi Webhook Settings](https://ko-fi.com/manage/webhooks)
3. Set the webhook URL to: `https://your-domain.com/api/kofi-webhook`
4. Copy the verification token and add it to your `.env` file
5. Save the webhook settings

### 3. Database Migration

The donations table will be automatically created when the server starts. If you need to run the migration manually:

```bash
node src/db/migrate.js
```

## How It Works

### Donation Matching

When a donation is received, the system attempts to match it to a user:

1. **By Nickname**: Compares the donor's name (from Ko-fi) with user nicknames (case-insensitive)
2. **By Email**: If nickname matching fails and an email is provided, matches by email address
3. **Manual Matching**: Admins can manually match unmatched donations through the API

### Automatic Re-matching

When a user updates their nickname, the system automatically:
- Matches any unmatched donations with the new nickname
- Unmatches donations that were previously matched by the old nickname

## API Endpoints

### Webhook Endpoint

**POST** `/api/kofi-webhook`
- Receives Ko-fi webhook notifications
- Automatically processes and stores donations
- Returns 200 OK to Ko-fi

### Admin Endpoints

**GET** `/api/donations`
- View all donations (admin only)
- Query parameters:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 50)
  - `user_id`: Filter by specific user
  - `unmatched`: Set to 'true' to show only unmatched donations

**PATCH** `/api/donations/:id/match`
- Manually match a donation to a user (admin only)
- Body: `{ "user_id": 123 }`

**GET** `/api/donations/stats`
- Get donation statistics
- Admins can see all stats
- Regular users can only see their own stats

## Database Schema

The `donations` table stores:
- Ko-fi transaction details (ID, amount, currency, type)
- Donor information (name, email if provided)
- Subscription information (if applicable)
- User matching information
- Complete webhook payload for reference

## Security Considerations

1. **Verification Token**: Always keep your Ko-fi verification token secret
2. **HTTPS**: Ensure your webhook endpoint uses HTTPS in production
3. **Rate Limiting**: The webhook endpoint is protected by the general API rate limiting
4. **Admin Access**: Donation viewing and manual matching require admin privileges

## Testing

To test the webhook integration:

1. Use Ko-fi's test webhook feature in the webhook settings
2. Or use a tool like curl to send a test webhook:

```bash
curl -X POST https://your-domain.com/api/kofi-webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'data={"verification_token":"your-token","kofi_transaction_id":"test-123","from_name":"Test User","amount":"5.00","currency":"USD","type":"Donation","timestamp":"2024-01-01T00:00:00Z"}'
```

## Troubleshooting

### Donations Not Matching

1. Check that users have set their nicknames in their profiles
2. Ensure nicknames match exactly (excluding case)
3. Check the server logs for matching attempts

### Webhook Not Received

1. Verify the webhook URL is correct and accessible
2. Check that the verification token matches
3. Ensure your server is running and accessible from the internet
4. Check server logs for any error messages

### Database Errors

1. Ensure the donations table exists (run migration)
2. Check database connection settings
3. Verify user permissions for the database