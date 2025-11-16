import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// your free SMTP (use Gmail, Brevo, or Mailtrap below)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
    user: "YOUR_EMAIL@gmail.com",
    pass: "YOUR_APP_PASSWORD", // not your Gmail password!
    },
});

app.post("/send-otp", async (req, res) => {
    const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP

    try {
    await transporter.sendMail({
        from: '"Your App" <YOUR_EMAIL@gmail.com>',
        to: email,
        subject: "Your OTP Code",
        text: 'Your OTP is ${otp}. It will expire in 5 minutes.',
    });

    res.json({ success: true, otp });
    } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to send email" });
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));