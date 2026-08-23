const nodemailer = require('nodemailer');

const getTransporter = () => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('Email credentials are not configured');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
    auth: { user, pass },
  });
};

async function recordEmail(db, { recipientEmail, recipientName, subject, body, relatedType, relatedId, status, sentAt }) {
  await db.query(
    `INSERT INTO email_outbox (recipient_email, recipient_name, subject, body, related_type, related_id, status, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [recipientEmail, recipientName || null, subject, body, relatedType, relatedId || null, status, sentAt || null]
  );
}

async function sendEmail(db, { recipientEmail, recipientName, subject, body, html, relatedType, relatedId, required = false }) {
  try {
    const transporter = getTransporter();
    const from = process.env.EMAIL_FROM || `Gates & Barriers <${process.env.EMAIL_USER || process.env.SMTP_USER}>`;
    await transporter.sendMail({
      from,
      to: recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail,
      subject,
      text: body,
      html: html || body.replace(/\n/g, '<br>'),
    });

    await recordEmail(db, {
      recipientEmail,
      recipientName,
      subject,
      body,
      relatedType,
      relatedId,
      status: 'sent',
      sentAt: new Date(),
    });

    return { sent: true };
  } catch (error) {
    console.error('SMTP send error:', error.message);
    await recordEmail(db, {
      recipientEmail,
      recipientName,
      subject,
      body,
      relatedType,
      relatedId,
      status: 'failed',
    }).catch((recordError) => console.error('Email outbox record error:', recordError.message));

    if (required) throw error;
    return { sent: false, error: error.message };
  }
}

async function sendRoleEmail(db, role, { subject, body, relatedType, relatedId }) {
  const result = await db.query(
    "SELECT email, full_name FROM users WHERE role = $1 AND account_status = 'active' AND email IS NOT NULL",
    [role]
  );

  for (const user of result.rows) {
    await sendEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject,
      body,
      relatedType,
      relatedId,
    });
  }
}

module.exports = { sendEmail, sendRoleEmail };
