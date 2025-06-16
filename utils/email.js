import nodemailer from 'nodemailer';

// Email templates
const emailTemplates = {
  passwordReset: (name, code) => ({
    subject: 'Your Password Reset Code - Tapyze',
    text: `Your password reset code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; text-align: center; margin-bottom: 30px;">🔐 Password Reset Code</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">Hello ${name},</p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">You requested to reset your password. Use the code below:</p>
          
          <div style="background-color: #f0f8ff; border: 2px dashed #007bff; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #007bff; font-size: 32px; letter-spacing: 4px; margin: 0; font-family: 'Courier New', monospace;">${code}</h1>
          </div>
          
          <p style="color: #555; font-size: 14px; line-height: 1.6;">⏰ <strong>This code will expire in 10 minutes</strong></p>
          
          <p style="color: #555; font-size: 14px; line-height: 1.6;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #888; font-size: 12px; text-align: center;">Tapyze - Secure Digital Payments</p>
        </div>
      </div>
    `
  }),

  merchantPasswordReset: (ownerName, businessName, code) => ({
    subject: 'Your Password Reset Code - Tapyze',
    text: `Your password reset code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; text-align: center; margin-bottom: 30px;">🔐 Password Reset Code</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">Hello ${ownerName},</p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">You requested to reset your password for <strong>${businessName}</strong>. Use the code below:</p>
          
          <div style="background-color: #f0f8ff; border: 2px dashed #007bff; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #007bff; font-size: 32px; letter-spacing: 4px; margin: 0; font-family: 'Courier New', monospace;">${code}</h1>
          </div>
          
          <p style="color: #555; font-size: 14px; line-height: 1.6;">⏰ <strong>This code will expire in 10 minutes</strong></p>
          
          <p style="color: #555; font-size: 14px; line-height: 1.6;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #888; font-size: 12px; text-align: center;">Tapyze - Secure Digital Payments</p>
        </div>
      </div>
    `
  }),

  generic: (message) => ({
    subject: 'Notification from Tapyze',
    text: message,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Tapyze</h2>
        <p>${message}</p>
        <p style="color: #666; font-size: 12px;">This is an automated message from Tapyze.</p>
      </div>
    `
  })
};

const sendEmail = async (options) => {
  try {
    // 1) Create a transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      },
      secure: false,
      requireTLS: true,
      logger: true,
      debug: true
    });

    // Prepare email content based on template type
    let emailContent;
    
    if (options.template === 'passwordReset') {
      emailContent = emailTemplates.passwordReset(options.name, options.code);
    } else if (options.template === 'merchantPasswordReset') {
      emailContent = emailTemplates.merchantPasswordReset(options.ownerName, options.businessName, options.code);
    } else {
      // Fallback to custom or generic template
      emailContent = {
        subject: options.subject || 'Notification from Tapyze',
        text: options.message,
        html: options.html || emailTemplates.generic(options.message).html
      };
    }

    // Define the email options
    const mailOptions = {
      from: `Tapyze App <${process.env.EMAIL_USERNAME}>`,
      to: options.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html
    };

    // Verify connection and send email
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

export { sendEmail };