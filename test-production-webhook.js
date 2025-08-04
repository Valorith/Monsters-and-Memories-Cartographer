// Test your production webhook endpoint
// Usage: node test-production-webhook.js https://yourdomain.com

const productionUrl = process.argv[2];

if (!productionUrl) {
  console.log('Usage: node test-production-webhook.js https://yourdomain.com');
  process.exit(1);
}

console.log(`Testing webhook at: ${productionUrl}/api/kofi-webhook`);

fetch(`${productionUrl}/api/kofi-webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'data=' + encodeURIComponent(JSON.stringify({
    verification_token: "b9ac8182-094b-46ce-b8df-ec623784ddac",
    message_id: "prod-test-" + Date.now(),
    timestamp: new Date().toISOString(),
    type: "Donation",
    is_public: true,
    from_name: "Production Test",
    message: "Testing production webhook",
    amount: "5.00",
    url: "https://ko-fi.com/Home/CoffeeShop?txid=PROD_TEST",
    email: "test@example.com",
    currency: "USD",
    is_subscription_payment: false,
    is_first_subscription_payment: false,
    kofi_transaction_id: "PROD_TEST_" + Date.now(),
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
  console.log('\nProduction webhook is working!');
})
.catch(error => {
  console.error('❌ Error:', error);
});