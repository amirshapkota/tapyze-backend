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

## RFID Card Tests

{{baseUrl}}/devices/cards/assign (POST)

Auth: Bearer Token

```
{
  "cardUid": "RFID12345678"
}
```

{{baseUrl}}/devices/cards (GET)
Auth: Bearer Token

{{baseUrl}}/devices/cards/{{cardId}}/deactivate
Auth: Bearer Token

```
{
  "reason": "LOST"
}
```

## NFC Scanner Tests

{{baseUrl}}/devices/scanners/assign (POST)
Auth: Bearer Token

```
{
  "deviceId": "NFC98765432",
  "model": "Scanner X1",
  "firmwareVersion": "1.0.0"
}
```

{{baseUrl}}/devices/scanners (GET)
Auth: Bearer Token

## RFID Payment Tests

### Verify RFID Card (Merchant View)

{{baseUrl}}/payments/rfid/verify/{{cardUid}} (GET)
Auth: Bearer Token

### Process RFID Payment (Merchant View)

{{baseUrl}}/payments/rfid/process
Auth: Bearer Token

```
{
  "cardUid": "{{cardUid}}",
  "amount": 200,
  "description": "Purchase at Test Shop"
}
```
