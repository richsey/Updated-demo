import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (toEmail, code) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'LMS Platform <onboarding@resend.dev>', // Use this default until you verify a custom domain
      to: [toEmail],
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>Welcome to the Platform!</h2>
          <p>Your email verification code is:</p>
          <h1 style="color: #4f46e5; letter-spacing: 4px;">${code}</h1>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error(`[Email] Resend API error for ${toEmail}:`, error);
      return false;
    }

    console.log(`[Email] Verification sent to ${toEmail}: ${data.id}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send to ${toEmail}:`, error);
    return false;
  }
};
