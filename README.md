# 🍽️ Mess Platform — Backend API

A production-ready Node.js/Express/MongoDB backend for a centralized mess (food hall) discovery platform.

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Runtime      | Node.js ≥ 18                        |
| Framework    | Express 4                           |
| Database     | MongoDB (Mongoose 8) + 2dsphere geo |
| Cache / Lock | Redis (ioredis)                     |
| Auth         | JWT (access + refresh token pair)   |
| File Storage | Cloudinary                          |
| Security     | Helmet, CORS, express-rate-limit    |
| Validation   | express-validator                   |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Fill in MONGO_URI, JWT secrets, Cloudinary keys

# 3. Seed the database
node scripts/seed.js

# 4. Start in development
npm run dev

# 5. Start in production
npm start
```

---

## Project Structure

```
mess-platform/
├── server.js                   Entry point
├── config/
│   ├── db.js                   MongoDB connection
│   ├── redis.js                Redis client + helpers
│   └── cloudinary.js           Cloudinary + multer upload instances
├── models/
│   ├── User.js                 role: student | mess_owner | admin
│   ├── Mess.js                 GeoJSON 2dsphere, denormalized avgRating/avgPrice
│   ├── MenuItem.js             post-save → recalculates Mess.avgPrice
│   ├── Review.js               post-save → recalculates Mess.avgRating
│   ├── DiscountCode.js         TTL index, virtuals: isExpired / isUsable
│   └── Redemption.js           tracks sharedBy for referral chain
├── middleware/
│   ├── auth.js                 protect, optionalAuth
│   ├── role.js                 authorize(...roles), isMessOwner
│   ├── validate.js             express-validator rule sets
│   ├── rateLimiter.js          authLimiter / apiLimiter / codeLimiter
│   └── errorHandler.js         global error + notFound handler
├── services/
│   ├── geo.service.js          getNearbyMesses, compareMesses, searchMesses
│   └── code.service.js         generateCode, validateCode, redeemCode (Redis lock)
├── controllers/
│   ├── auth.controller.js
│   ├── mess.controller.js
│   ├── menu.controller.js
│   ├── review.controller.js
│   └── discount.controller.js
├── routes/
│   ├── auth.routes.js
│   ├── mess.routes.js
│   ├── menu.routes.js
│   ├── review.routes.js
│   └── discount.routes.js
├── utils/
│   ├── apiError.js
│   ├── apiResponse.js
│   └── asyncHandler.js
└── scripts/
    └── seed.js
```

---

## Environment Variables

| Variable                 | Description                             |
|--------------------------|-----------------------------------------|
| `PORT`                   | Server port (default 5000)             |
| `NODE_ENV`               | development / production                |
| `MONGO_URI`              | MongoDB connection string               |
| `JWT_ACCESS_SECRET`      | Min 32-char secret for access tokens   |
| `JWT_REFRESH_SECRET`     | Min 32-char secret for refresh tokens  |
| `JWT_ACCESS_EXPIRE`      | e.g. `15m`                             |
| `JWT_REFRESH_EXPIRE`     | e.g. `7d`                              |
| `REDIS_URL`              | Redis connection string                 |
| `CLOUDINARY_CLOUD_NAME`  | Cloudinary config                       |
| `CLOUDINARY_API_KEY`     | Cloudinary config                       |
| `CLOUDINARY_API_SECRET`  | Cloudinary config                       |
| `CLIENT_URL`             | Frontend URL (for CORS + share links)  |

---

## API Reference

All endpoints return:
```json
{ "success": true, "message": "...", "data": { ... } }
```

### Auth  `/api/auth`

| Method | Endpoint          | Auth  | Description          |
|--------|-------------------|-------|----------------------|
| POST   | `/register`       | —     | Register new user    |
| POST   | `/login`          | —     | Login, get tokens    |
| POST   | `/refresh-token`  | —     | Rotate access token  |
| POST   | `/logout`         | ✅    | Invalidate session   |
| GET    | `/me`             | ✅    | Get current user     |
| PATCH  | `/me`             | ✅    | Update profile       |
| PATCH  | `/me/password`    | ✅    | Change password      |

**Register body:**
```json
{
  "name": "Arjun Singh",
  "email": "arjun@college.edu",
  "password": "pass1234",
  "role": "student",
  "phone": "9876543210",
  "college": "COEP"
}
```

---

### Mess  `/api/mess`

| Method | Endpoint              | Auth         | Description            |
|--------|-----------------------|--------------|------------------------|
| GET    | `/nearby`             | optional     | Geo-sorted mess list   |
| GET    | `/compare?ids=a,b,c`  | optional     | Side-by-side compare   |
| GET    | `/search?q=keyword`   | optional     | Full-text search       |
| GET    | `/:id`                | optional     | Single mess detail     |
| GET    | `/my/messes`          | mess_owner   | Owner's own messes     |
| GET    | `/`                   | admin        | All messes (paginated) |
| POST   | `/`                   | mess_owner   | Register new mess      |
| PATCH  | `/:id`                | mess_owner   | Update mess            |
| PATCH  | `/:id/approve`        | admin        | Approve / reject       |
| DELETE | `/:id`                | owner/admin  | Delete mess            |

**Nearby query params:**
```
lat=18.52&lng=73.85&radius=5&sort=rating&category=veg&minRating=3&maxPrice=100&page=1&limit=10
```

---

### Menu  `/api/mess/:messId/menu`

| Method | Endpoint                      | Auth       | Description          |
|--------|-------------------------------|------------|----------------------|
| GET    | `/`                           | optional   | Get menu (grouped)   |
| POST   | `/`                           | mess_owner | Add item             |
| POST   | `/bulk`                       | mess_owner | Add multiple items   |
| PATCH  | `/:itemId`                    | mess_owner | Update item          |
| PATCH  | `/:itemId/toggle`             | mess_owner | Toggle availability  |
| DELETE | `/:itemId`                    | mess_owner | Delete item          |

---

### Reviews  `/api/mess/:messId/reviews`

| Method | Endpoint                    | Auth    | Description            |
|--------|-----------------------------|---------|------------------------|
| GET    | `/`                         | optional| List reviews + stats   |
| POST   | `/`                         | student | Post a review          |
| DELETE | `/api/mess/reviews/:id`     | student | Delete own review      |
| POST   | `/api/mess/reviews/:id/like`| student | Toggle like            |
| GET    | `/api/mess/my/reviews`      | student | All my reviews         |

---

### Discount  `/api/mess/:messId/codes` + `/api/discount`

| Method | Endpoint                         | Auth       | Description               |
|--------|----------------------------------|------------|---------------------------|
| POST   | `/api/mess/:messId/codes`        | mess_owner | Generate code             |
| GET    | `/api/mess/:messId/codes`        | mess_owner | List codes                |
| PATCH  | `/api/mess/:messId/codes/:id/toggle` | mess_owner | Activate / deactivate |
| GET    | `/api/mess/:messId/redemptions`  | mess_owner | Redemption history + stats|
| POST   | `/api/discount/validate`         | student    | Check code (no consume)   |
| POST   | `/api/discount/redeem`           | student    | Apply code to bill        |
| POST   | `/api/discount/share`            | any        | Get shareable deep link   |
| GET    | `/api/discount/history`          | student    | My redemption history     |

**Redeem body:**
```json
{
  "code": "SHIV-A3F9B2",
  "messId": "...",
  "billAmount": 120,
  "sharedBy": "userId-who-sent-you-the-code"
}
```

**Redeem response:**
```json
{
  "savings": 12.00,
  "finalAmount": 108.00,
  "redemption": { "status": "confirmed", "confirmedAt": "..." }
}
```

---

## Key Design Decisions

### Geo queries
`Mess.location` uses a **2dsphere** index. Queries use MongoDB `$near` operator which returns results ordered by distance automatically. Both `User` and `Mess` store GeoJSON `Point` with `[longitude, latitude]` (GeoJSON standard order).

### Denormalized fields
`Mess.avgRating` and `Mess.avgPrice` are computed by **Mongoose post-save hooks** on `Review` and `MenuItem` respectively. This means every geo/sort query is a single collection read with no `$lookup`.

### Redis distributed lock (code redemption)
When a student redeems a code, a 30-second Redis lock prevents the same user from double-submitting the same code concurrently. The actual `usedCount` counter still lives in MongoDB for durability.

### Verified reviews
A review is flagged `isVerified: true` if the student has a confirmed `Redemption` at that mess. This gives weight to reviews from students who actually visited.

### Referral chain
`Redemption.sharedBy` stores the userId of who forwarded the discount code. Enables future referral reward features without any schema migration.

---

## Seed Credentials

After running `node scripts/seed.js`:

| Role        | Email               | Password    |
|-------------|---------------------|-------------|
| admin       | admin@mess.com      | Admin@123   |
| mess_owner  | ravi@mess.com       | Owner@123   |
| mess_owner  | priya@mess.com      | Owner@123   |
| student     | arjun@mess.com      | Student@123 |
| student     | sneha@mess.com      | Student@123 |

Sample codes: `SHIV-DEMO1` (10% off) · `ANNA-FLAT2` (₹20 off)
