const swaggerJsdoc = require("swagger-jsdoc");
const m2s = require("mongoose-to-swagger");

// 🔥 Import your Mongoose models
const User = require("../models/User.js"); // adjust path if needed

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Some Random Platform",
      version: "1.0.0",
      description: "Something long description",
    },

    servers: [{ url: "http://localhost:5000" }],

    components: {
      // 🔐 Auth config
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },

      // 🔥 Auto-generated schemas from Mongoose
      schemas: {
        User: {
          ...m2s(User),
          properties: {
            ...m2s(User).properties,
            password: { type: "string", writeOnly: true },
          },
        },
      },
    },

    security: [{ bearerAuth: [] }],
  },

  apis: ["./routes/*.js"],
};

module.exports = swaggerJsdoc(options);
