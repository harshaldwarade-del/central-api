const router = require("express").Router({ mergeParams: true });
const ctrl = require("../controllers/menu.controller");
const { protect, optionalAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/role");
const { uploadMenuImage } = require("../config/cloudinary");

// GET is public
router.get("/:messId/menu", optionalAuth, ctrl.getMenu);

// Mess owner only
router.post(
  "/:messId/menu",
  protect,
  authorize("mess_owner", "admin"),
  uploadMenuImage.single("image"),
  ctrl.addItem,
);

router.post(
  "/:messId/menu/bulk",
  protect,
  authorize("mess_owner", "admin"),
  ctrl.bulkAdd,
);

router.patch(
  "/:messId/menu/:itemId",
  protect,
  authorize("mess_owner", "admin"),
  uploadMenuImage.single("image"),
  ctrl.updateItem,
);

router.patch(
  "/:messId/menu/:itemId/toggle",
  protect,
  authorize("mess_owner", "admin"),
  ctrl.toggleAvailability,
);

router.delete(
  "/:messId/menu/:itemId",
  protect,
  authorize("mess_owner", "admin"),
  ctrl.deleteItem,
);

module.exports = router;
