const router = require("express").Router();
const ctrl = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { uploadAvatar } = require("../config/cloudinary");

// Public
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:     { type: string, example: Arjun Singh }
 *               email:    { type: string, example: arjun@coep.edu }
 *               password: { type: string, example: Student@123 }
 *               role:     { type: string, enum: [student, mess_owner], default: student }
 *               phone:    { type: string, example: '9876543210' }
 *               college:  { type: string, example: COEP Pune }
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.post("/register", authLimiter, ctrl.register);

router.post("/login", authLimiter, ctrl.login);
router.post("/refresh-token", ctrl.refreshToken);

// Protected
router.use(protect);

router.post("/logout", ctrl.logout);
router.get("/me", ctrl.getMe);
router.patch("/me", uploadAvatar.single("avatar"), ctrl.updateProfile);
router.patch("/me/password", ctrl.changePassword);

module.exports = router;
