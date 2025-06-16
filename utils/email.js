import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  try {
    // 1) Create a transporter - FIXED: use createTransport (not createTransporter)
    const transporter = nodemailer.createTransport({
      // For Gmail
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      },
      // Additional Gmail settings
      secure: false, // Use TLS
      requireTLS: true,
      logger: true, // Enable logging
      debug: true // Enable debug output
    });

    // 2) Define the email options
    const mailOptions = {
      from: `Tapyze App <${process.env.EMAIL_USERNAME}>`, // Use the same email as sender
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Tapyze - Password Reset</h2>
          <p>${options.message}</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    // 3) Verify connection
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    // 4) Actually send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

export { sendEmail };