#!/bin/bash
echo "Testing Ko-fi webhook at https://mmcartographer.com/api/kofi-webhook"
echo "---"

# Test with a simple POST request
curl -X POST https://mmcartographer.com/api/kofi-webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'data={"test":"true"}' \
  -v 2>&1 | grep -E "(< HTTP|< Location|< Content)"