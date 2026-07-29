import nodemailer from 'nodemailer';

// Configure your SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (toEmail, code) => {
  const mailOptions = {
    from: `"LMS Platform" <${process.env.EMAIL_USER || 'no-reply@lms.com'}>`,
    to: toEmail,
    subject: 'Your Verification Code',
    text: `Welcome! Your verification code is: ${code}. It expires in 15 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
        <h2>Welcome to the Platform!</h2>
        <p>Your email verification code is:</p>
        <h1 style="color: #4f46e5; letter-spacing: 4px;">${code}</h1>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Verification sent to ${toEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send to ${toEmail}:`, error);
    return false;
  }
};
