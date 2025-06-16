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

PATCH /api/auth/customer/change-password
Authorization: Bearer {jwt-token}
Content-Type: application/json

```
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123",
  "confirmNewPassword": "newpassword123"
}
```

GET /api/auth/customer/profile
Authorization: Bearer {jwt-token}

PATCH /api/auth/customer/profile
Authorization: Bearer {jwt-token}
Content-Type: application/json

```
{
  "fullName": "Updated Name",
  "phone": "1234567890",
  "gender": "Male"
}
```

PATCH /api/auth/merchant/change-password
Authorization: Bearer {jwt-token}
Content-Type: application/json

```
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123",
  "confirmNewPassword": "newpassword123"
}
```

GET /api/auth/merchant/profile
Authorization: Bearer {jwt-token}

PATCH /api/auth/merchant/profile
Authorization: Bearer {jwt-token}
Content-Type: application/json

```
{
  "businessName": "Updated Business Name",
  "ownerName": "Updated Owner Name",
  "phone": "1234567890",
  "businessAddress": "Updated Address",
  "businessType": "Updated Type"
}
```

### Forgot Password

POST /api/auth/customer/forgot-password
Content-Type: application/json

```
{
  "email": "customer@example.com"
}
```

POST /api/auth/customer/reset-password
Content-Type: application/json

```
{
  "code": "123456",
  "password": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

POST /api/auth/merchant/forgot-password
Content-Type: application/json

```
{
  "email": "merchant@example.com"
}
```

POST /api/auth/merchant/reset-password
Content-Type: application/json

```
{
  "code": "123456",
  "password": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

## Wallet Requests

{{baseUrl}}/wallet/balance (GET)

Auth: Bearer Token

{{baseUrl}}/wallet/topup (POST)
Auth: Bearer Token

````

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
"cardUid": "RF001234567890",
"pin": "1234"
}

```

{{baseUrl}}/api/devices/cards/verify-pin (POST)
Authorization: Bearer {{customerToken}}

```

{
"cardUid": "RF001234567890",
"pin": "1234"
}

```

{{baseUrl}}/devices/cards (GET)
Auth: Bearer Token

{{baseUrl}}/devices/cards/{{cardId}}/deactivate (PATCH)
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

{{baseUrl}}/devices/scanners/{{scannerId}} (PATCH)
Auth: Bearer Token

```

{
"status": "MAINTENANCE",
"firmwareVersion": "1.0.1"
}

```

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

## Admin

Creating first admin (one time setup)

{{baseUrl}}/auth/admin/setup(POST)

```

{
"fullName": "Super Admin",
"email": "admin@example.com",
"password": "securePassword123",
"confirmPassword": "securePassword123",
"setupKey": "your-very-secure-random-string"
}

```

{{baseUrl}}/auth/admin/login (POST)

```

{
"email": "admin@example.com",
"password": "adminpassword123"
}

```

{{baseUrl}}/devices/admin/cards/assign/{{customerId}} (POST)
Auth: Bearer Token

```

{
"cardUid": "RFID87654321"
}

```

{{baseUrl}}/devices/admin/customers/{{customerId}}/cards (GET)
Auth: Bearer Token

{{baseUrl}}/devices/admin/scanners/assign/{{merchantId}} (POST)
Auth: Bearer Token

```

{
"deviceId": "NFC43210987",
"model": "Scanner Pro",
"firmwareVersion": "2.0.0"
}

```

{{baseUrl}}/devices/admin/merchants/{{merchantId}}/scanners (GET)
Auth: Bearer Token

{{baseUrl}}/admin/customers (GET)
Auth: Bearer Token

{{baseUrl}}/admin/merchants (GET)
Auth: Bearer Token

{{baseUrl}}/admin/transactions (GET)
Auth: Bearer Token

{{baseUrl}}/devices/cards/{{cardId}}/deactivate (PATCH)
Auth: Bearer Token

```

{
"reason": "LOST"
}

```

{{baseUrl}}/devices/scanners/{{scannerId}} (PATCH)
Auth: Bearer Token

```

{
"status": "MAINTENANCE",
"firmwareVersion": "2.0.0"
}

```

{{baseUrl}}/devices/admin/cards?page=1&limit=10&isActive=true (GET)
Auth: Bearer Token

{{baseUrl}}/devices/admin/scanners?page=1&limit=10&status=ONLINE (GET)
Auth: Bearer Token

### Create a New Admin

{{baseUrl}}/auth/admin/create (POST)
Auth: Bearer Token

```

{
"fullName": "Support Admin",
"email": "support@wallet.com",
"password": "Support123",
"confirmPassword": "Support123",
"role": "ADMIN"
}

```

{{baseUrl}}/admin/admins (GET)
Auth: Bearer Token
```
````
