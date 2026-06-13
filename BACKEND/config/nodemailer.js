// // --- FILE: config/nodemailer.js ---

// import nodemailer from "nodemailer";
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// dotenv.config({ path: path.resolve(__dirname, "../.env") });

// const port = parseInt(process.env.SMTP_PORT) || 465;
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST || "smtp.gmail.com",
//   port: port,
//   secure: port === 465, // true for 465, false for 587
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
//   tls: {
//     rejectUnauthorized: false // Helps with some email providers and development environments
//   }
// });

// // Verify connection configuration
// transporter.verify(function (error, success) {
//   if (error) {
//     console.log("❌ Email Server Error:", error);
//   } else {
//     console.log("✅ Email Server is ready to take messages");
//   }
// });

// export default transporter;
