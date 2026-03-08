import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { Pool } from "pg";
import nodemailer from "nodemailer";
import { Resend } from "resend";

function buildTrustedOrigins() {
    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const origins = new Set<string>([baseUrl]);

    try {
        const parsed = new URL(baseUrl);
        const port = parsed.port ? `:${parsed.port}` : "";

        if (parsed.hostname === "localhost") {
            origins.add(`${parsed.protocol}//127.0.0.1${port}`);
        }

        if (parsed.hostname === "127.0.0.1") {
            origins.add(`${parsed.protocol}//localhost${port}`);
        }
    } catch {
        origins.add("http://localhost:3000");
        origins.add("http://127.0.0.1:3000");
    }

    return [...origins];
}

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const transporter = process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    })
    : null;

async function sendVerificationMessage(to: string, subject: string, html: string) {
    if (resend) {
        const from = process.env.RESEND_FROM_EMAIL || "BuffQuest <onboarding@resend.dev>";
        const replyTo = process.env.RESEND_REPLY_TO || process.env.EMAIL_USER || undefined;
        try {
            const { error } = await resend.emails.send({
                from,
                to: [to],
                subject,
                html,
                replyTo,
            });

            if (error) {
                throw new Error(error.message || "Resend delivery failed.");
            }

            return;
        } catch (error) {
            console.warn("Resend delivery failed, falling back to SMTP:", error);
        }
    }

    if (!transporter) {
        throw new Error("No email provider is configured. Set RESEND_API_KEY or EMAIL_USER/EMAIL_PASS.");
    }

    await transporter.sendMail({
        from: `"BuffQuest" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
}

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: buildTrustedOrigins(),
    database: new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1, // important for serverless
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },
    emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
            // Rewrite verification URL to always use the configured base URL
            // (prevents localhost links when triggered from local dev)
            const baseURL = process.env.BETTER_AUTH_URL || '';
            const parsed = new URL(url);
            const correctUrl = new URL(parsed.pathname + parsed.search, baseURL).toString();

            try {
                await sendVerificationMessage(
                    user.email,
                    "Verify your email address for BuffQuest",
                    `<p>Please click the link below to verify your email address:</p><p><a href="${correctUrl}">Verify Email</a></p>`
                );
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unknown error";
                console.error("Failed to send verification email:", message, error);
                throw new APIError("BAD_REQUEST", { message: "Failed to send verification email: " + message });
            }
        },
    },
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    if (!user.email.endsWith("@colorado.edu")) {
                        throw new APIError("BAD_REQUEST", {
                            message: "Only @colorado.edu emails are allowed to register.",
                        });
                    }
                    return { data: user };
                },
            },
        },
    },
});