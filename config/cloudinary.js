const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Storage factories ───────────────────────────────────────────────────────

const makeStorage = (folder, allowedFormats = ["jpg", "jpeg", "png", "webp"]) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `mess_platform/${folder}`,
      allowed_formats: allowedFormats,
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    },
  });

// Mess hero images
const messImageStorage = makeStorage("mess_images");

// Menu item images
const menuItemStorage = makeStorage("menu_items");

// Review images
const reviewImageStorage = makeStorage("review_images");

// Avatar
const avatarStorage = makeStorage("avatars");

// ─── Multer instances ────────────────────────────────────────────────────────

const fileSizeLimitMB = (mb) => ({ fileSize: mb * 1024 * 1024 });

const uploadMessImages = multer({
  storage: messImageStorage,
  limits: fileSizeLimitMB(5),
});
const uploadMenuImage = multer({
  storage: menuItemStorage,
  limits: fileSizeLimitMB(3),
});
const uploadReviewImage = multer({
  storage: reviewImageStorage,
  limits: fileSizeLimitMB(4),
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: fileSizeLimitMB(2),
});

// ─── Delete helper ────────────────────────────────────────────────────────────

const deleteImage = async (publicId) => {
  if (!publicId) return;
  return cloudinary.uploader.destroy(publicId);
};

module.exports = {
  cloudinary,
  uploadMessImages,
  uploadMenuImage,
  uploadReviewImage,
  uploadAvatar,
  deleteImage,
};
