# tapyze-backend

Example:

baseUrl: http://localhost:5000/api

## Authentication Requests

{{baseUrl}}/auth/customer/signup (POST)

```
{
  "fullName": "Test Customer",
  "email": "customer@example.com",
  "phone": "1234567890",
  "gender": "Male",
  "password": "password123",
  "confirmPassword": "password123"
}
```

{{baseUrl}}/auth/customer/login (POST)

```
{
  "email": "customer@example.com",
  "password": "password123"
}
```

{{baseUrl}}/auth/merchant/signup (POST)

```
{
  "businessName": "Test Business",
  "ownerName": "Test Owner",
  "email": "merchant@example.com",
  "phone": "0987654321",
  "businessAddress": "123 Business St, City",
  "businessType": "Retail",
  "password": "password123",
  "confirmPassword": "password123"
}
```

{{baseUrl}}/auth/merchant/login (POST)

```
{
  "email": "merchant@example.com",
  "password": "password123"
}
```

## Wallet Requests

{{baseUrl}}/wallet/balance (GET)

Auth: Bearer Token

{{baseUrl}}/wallet/topup (POST)
Auth: Bearer Token

```
{
  "amount": 1000
}
```

{{baseUrl}}/wallet/transfer (POST)
Auth: Bearer Token

```
{
  "recipientId": "id",
  "recipientType": "Merchant",
  "amount": 500,
  "description": "Payment for services"
}
```

{{baseUrl}}/wallet/transactions (GET)
Auth: Bearer Token
