import nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let transporter: nodemailer.Transporter | null | undefined;
let mailConfigWarningShown = false;

const isMailEnabled = () => {
  const value = (process.env.MAIL_ENABLED ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
};

const getSmtpPort = () => {
  const raw = process.env.SMTP_PORT?.trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getSmtpSecure = () => {
  const value = (process.env.SMTP_SECURE ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
};

const getMailFrom = () => {
  const value = process.env.MAIL_FROM?.trim();
  return value || null;
};

const getTransporter = () => {
  if (transporter !== undefined) {
    return transporter;
  }

  if (!isMailEnabled()) {
    transporter = null;
    return transporter;
  }

  const host = process.env.SMTP_HOST?.trim();
  const port = getSmtpPort();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || port == null || !user || !pass) {
    if (!mailConfigWarningShown) {
      console.warn(
        "MAIL_ENABLED esta activo pero faltan SMTP_HOST, SMTP_PORT, SMTP_USER o SMTP_PASS. Se omiten envios por email."
      );
      mailConfigWarningShown = true;
    }
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: getSmtpSecure(),
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

export const sendMail = async ({ to, subject, text, html }: MailPayload) => {
  const resolvedTransporter = getTransporter();
  const from = getMailFrom();

  if (!resolvedTransporter || !from) {
    if (isMailEnabled() && !mailConfigWarningShown && !from) {
      console.warn(
        "MAIL_ENABLED esta activo pero falta MAIL_FROM. Se omiten envios por email."
      );
      mailConfigWarningShown = true;
    }
    return { delivered: false as const, reason: "disabled_or_unconfigured" as const };
  }

  await resolvedTransporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return { delivered: true as const };
};
