import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  // Create a transporter
  const transporter = nodemailer.createTransporter({
    // For Gmail
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
    
    // For other email services:
    /*
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
    */
  });

  // Define the email options
  const mailOptions = {
    from: `Your App Name <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || `<p>${options.message}</p>`
  };

  // Actually send the email
  await transporter.sendMail(mailOptions);
};

export { sendEmail };