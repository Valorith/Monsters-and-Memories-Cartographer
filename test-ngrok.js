// Test script to verify ngrok is working
// Run this after starting ngrok: node test-ngrok.js YOUR_NGROK_URL

const ngrokUrl = process.argv[2];

if (!ngrokUrl) {
  console.log('Usage: node test-ngrok.js https://your-ngrok-url.ngrok-free.app');
  process.exit(1);
}

console.log(`Testing ngrok tunnel at: ${ngrokUrl}`);

// Test the API endpoint through ngrok
fetch(`${ngrokUrl}/api/kofi-webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'data=' + encodeURIComponent(JSON.stringify({
    verification_token: "b9ac8182-094b-46ce-b8df-ec623784ddac",
    message_id: "ngrok-test-" + Date.now(),
    timestamp: new Date().toISOString(),
    type: "Donation",
    is_public: true,
    from_name: "Ngrok Test",
    message: "Testing ngrok tunnel",
    amount: "5.00",
    url: "https://ko-fi.com/Home/CoffeeShop?txid=NGROK_TEST",
    email: "test@example.com",
    currency: "USD",
    is_subscription_payment: false,
    is_first_subscription_payment: false,
    kofi_transaction_id: "NGROK_TEST_" + Date.now(),
    shop_items: null,
    tier_name: null,
    shipping: null
  }))
})
.then(response => {
  console.log(`✅ Response status: ${response.status}`);
  return response.json();
})
.then(data => {
  console.log('✅ Response data:', data);
  console.log('\nNgrok tunnel is working! You can now configure this URL in Ko-fi.');
})
.catch(error => {
  console.error('❌ Error:', error);
  console.log('\nMake sure:');
  console.log('1. Your server is running on port 4174');
  console.log('2. Ngrok is running: ngrok http 4174');
  console.log('3. You\'re using the correct ngrok URL');
});