import nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let transporter: nodemailer.Transporter | null | undefined;
let mailConfigWarningShown = false;
let transporterVerified = false;

const isMailEnabled = () => {
  const value = (process.env.MAIL_ENABLED ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
};

const readEnvValue = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
};

const getSmtpPort = () => {
  const raw = readEnvValue("MAIL_PORT", "SMTP_PORT");
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getSmtpSecure = () => {
  const value = (readEnvValue("MAIL_SECURE", "SMTP_SECURE") ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
};

const getMailFrom = () => {
  const value = readEnvValue("MAIL_FROM");
  return value || null;
};

const getMailHost = () => readEnvValue("MAIL_HOST", "SMTP_HOST");

const getMailUser = () => readEnvValue("MAIL_USER", "SMTP_USER", "GMAIL_USER");

const getMailPass = () =>
  readEnvValue("MAIL_PASS", "SMTP_PASS", "GMAIL_APP_PASSWORD");

const getMailConfigSnapshot = () => ({
  enabled: isMailEnabled(),
  from: Boolean(getMailFrom()),
  host: getMailHost(),
  port: getSmtpPort(),
  secure: getSmtpSecure(),
  user: getMailUser(),
  passConfigured: Boolean(getMailPass()),
});

const getTransporter = () => {
  if (transporter !== undefined) {
    return transporter;
  }

  if (!isMailEnabled()) {
    transporter = null;
    return transporter;
  }

  const host = getMailHost();
  const port = getSmtpPort();
  const user = getMailUser();
  const pass = getMailPass();

  if (!host || port == null || !user || !pass) {
    if (!mailConfigWarningShown) {
      console.warn(
        "MAIL_ENABLED esta activo pero faltan MAIL_HOST/SMTP_HOST, MAIL_PORT/SMTP_PORT, MAIL_USER/SMTP_USER/GMAIL_USER o MAIL_PASS/SMTP_PASS/GMAIL_APP_PASSWORD. Se omiten envios por email."
      );
      console.warn("Estado config mail:", {
        ...getMailConfigSnapshot(),
        user: user ? "***" : null,
      });
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

const ensureTransporterVerified = async (
  resolvedTransporter: nodemailer.Transporter
) => {
  if (transporterVerified) {
    return;
  }

  await resolvedTransporter.verify();
  transporterVerified = true;
  console.info("SMTP verificado correctamente para envio de notificaciones.");
};

export const sendMail = async ({ to, subject, text, html }: MailPayload) => {
  const safeRecipient = to.trim().toLowerCase();
  if (!safeRecipient) {
    console.warn("No se envia email: destinatario vacio.");
    return { delivered: false as const, reason: "missing_recipient" as const };
  }

  const resolvedTransporter = getTransporter();
  const from = getMailFrom();

  if (!resolvedTransporter || !from) {
    if (isMailEnabled() && !mailConfigWarningShown && !from) {
      console.warn(
        "MAIL_ENABLED esta activo pero falta MAIL_FROM. Se omiten envios por email."
      );
      mailConfigWarningShown = true;
    }
    console.info("Email omitido por configuracion incompleta.", {
      to: safeRecipient,
      subject,
      config: {
        ...getMailConfigSnapshot(),
        user: getMailUser() ? "***" : null,
      },
    });
    return { delivered: false as const, reason: "disabled_or_unconfigured" as const };
  }

  console.info("Intentando enviar email de notificacion.", {
    to: safeRecipient,
    subject,
    from,
  });

  await ensureTransporterVerified(resolvedTransporter);

  const info = await resolvedTransporter.sendMail({
    from,
    to: safeRecipient,
    subject,
    text,
    html,
  });

  console.info("Email de notificacion enviado.", {
    to: safeRecipient,
    subject,
    messageId: info.messageId,
  });

  return { delivered: true as const };
};
