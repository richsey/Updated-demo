import nodemailer from 'nodemailer';

// Configure your SMTP transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587, // Use 587 for STARTTLS, which is less frequently blocked than 465
  secure: false, // true for 465, false for other ports
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
    // If testing locally or on Railway without a proper SMTP provider, 
    // you can set MOCK_EMAIL=true in your .env to bypass SMTP entirely.
    if (process.env.MOCK_EMAIL === 'true') {
      console.log(`[MOCK EMAIL] Verification code for ${toEmail} is: ${code}`);
      return true;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Verification sent to ${toEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send to ${toEmail}:`, error.message);
    // FALLBACK: If Railway blocks the port, we still allow the user to register
    // by printing the code to the Railway logs so they can copy-paste it.
    console.log(`\n======================================================`);
    console.log(`⚠️ SMTP FAILED - MOCK FALLBACK ⚠️`);
    console.log(`The verification code for ${toEmail} is: ${code}`);
    console.log(`======================================================\n`);
    
    // We return true here so the frontend can proceed to the verification screen
    // instead of throwing a 500 error and halting the registration flow.
    return true;
  }
};
