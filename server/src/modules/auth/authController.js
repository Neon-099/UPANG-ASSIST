const crypto = require("crypto");
const argon2 = require("argon2");
const User = require("../../models/User");
const LoginAttempt = require("../../models/LoginAttempt");
const PendingRegistration = require("../../models/PendingRegistration");
const { normalizeEmail } = require("../../utils/emailPolicy");
const { createAccessToken } = require("../../utils/jwt");
const { sendRecoveryOtp, sendRegistrationOtp, describeRecoveryEmailError } = require("../../utils/recoveryEmail");

const RECOVERY_RESPONSE = "If an active account matches that PHINMA email, a password reset code has been sent.";
const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const LOGIN_LOCKOUT_STEP_MS = 15 * 1000;
const LOGIN_LOCKOUT_MAX_ATTEMPTS = 3;
const OTP_MAX_ATTEMPTS = 5;
const REGISTRATION_OTP_TTL_MS = 10 * 60 * 1000;
const REGISTRATION_RESEND_WAIT_MS = 60 * 1000;
const REGISTRATION_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const REGISTRATION_COOKIE = "upang_registration_session";
const UPANG_EMAIL_DOMAIN = "phinmaed.com";
const UPANG_EMAIL_ACCESS_ERROR = "Use your UPang PHINMA email in the format first.last.up@phinmaed.com (30 characters maximum).";
const NAME_LETTERS_AND_SPACES = /^\p{L}+(?: \p{L}+)*$/u;

function isValidName(value) {
  const name = typeof value === "string" ? value.normalize("NFC") : "";
  return name.length >= 2 && name.length <= 30 && NAME_LETTERS_AND_SPACES.test(name);
}

function isAllowedUpangEmail(value) {
  // Callers pass only primitive strings; String() makes the value used for
  // validation explicit while request-body objects and arrays are rejected.
  const email = String(value ?? "").trim().toLowerCase();
  // Require at least two dot-separated username parts followed by `.up`.
  // The complete match also rejects whitespace, extra @ signs, and other domains.
  return email.length <= 30 && /^[a-z0-9]+(?:[.][a-z0-9]+)+[.]up@phinmaed[.]com$/.test(email);
}

function hasRequiredPasswordCharacter(password) {
  return /[^A-Za-z0-9\s]/.test(password);
}

function hasUniqueSpecialCharacters(password) {
  const specialCharacters = [...password].filter((character) => !/[\p{L}\p{N}\s]/u.test(character));
  return specialCharacters.length > 0 && new Set(specialCharacters).size === specialCharacters.length;
}

function normalizeRequestEmail(body) {
  // Never coerce objects or arrays into query values. The request middleware
  // rejects them; this guard also keeps direct controller calls safe.
  if (typeof body?.email !== "string") return "";
  return normalizeEmail(String(body.email));
}

function registrationCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: REGISTRATION_SESSION_TTL_MS, path: "/api/auth/register" };
}

async function findPendingRegistration(req) {
  const token = req.cookies?.[REGISTRATION_COOKIE];
  if (typeof token !== "string" || token.length !== 64) return null;
  return PendingRegistration.findOne({ resumeTokenHash: hashRecoveryValue(token), expiresAt: { $gt: new Date() } })
    .select("+otpHash +otpExpiresAt +otpRequestedAt +otpAttempts +passwordHash");
}

async function getPendingRegistration(req, res) {
  try {
    const pending = await findPendingRegistration(req);
    if (!pending) return res.status(404).json({ error: "Your verification session expired. Please register again." });
    return res.status(200).json({ email: pending.email, resendAt: pending.otpRequestedAt ? pending.otpRequestedAt.getTime() + REGISTRATION_RESEND_WAIT_MS : Date.now(), expiresAt: pending.otpExpiresAt?.getTime() || null });
  } catch (error) {
    console.error("Unable to restore registration verification:", error.message);
    return res.status(500).json({ error: "Unable to restore email verification" });
  }
}

async function cancelPendingRegistration(req, res) {
  try {
    const token = req.cookies?.[REGISTRATION_COOKIE];
    if (typeof token === "string" && token.length === 64) {
      await PendingRegistration.deleteOne({ resumeTokenHash: hashRecoveryValue(token) });
    }
    res.clearCookie(REGISTRATION_COOKIE, { ...registrationCookieOptions(), maxAge: undefined });
    return res.status(204).send();
  } catch (error) {
    console.error("Unable to cancel registration verification:", error.message);
    return res.status(500).json({ error: "Unable to cancel email verification" });
  }
}

async function resendRegistrationOtp(req, res) {
  try {
    const pending = await findPendingRegistration(req);
    if (!pending) return res.status(404).json({ error: "Your verification session expired. Please register again." });
    const now = Date.now();
    if (pending.otpRequestedAt && now - pending.otpRequestedAt.getTime() < REGISTRATION_RESEND_WAIT_MS) {
      return res.status(429).json({ code: "REGISTRATION_OTP_RECENTLY_SENT", error: "Please wait before requesting another code.", resendAt: pending.otpRequestedAt.getTime() + REGISTRATION_RESEND_WAIT_MS });
    }
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashRecoveryValue(`${pending.email}:${otp}`);
    await PendingRegistration.updateOne({ _id: pending._id, resumeTokenHash: hashRecoveryValue(req.cookies[REGISTRATION_COOKIE]) }, {
      $set: { otpHash, otpExpiresAt: new Date(now + REGISTRATION_OTP_TTL_MS), otpRequestedAt: new Date(now), otpAttempts: 0, expiresAt: new Date(now + REGISTRATION_SESSION_TTL_MS) },
    });
    try { await sendRegistrationOtp(pending.email, otp); }
    catch (mailError) {
      await PendingRegistration.updateOne({ _id: pending._id, otpHash }, { $unset: { otpHash: 1, otpExpiresAt: 1 } });
      const failure = describeRecoveryEmailError(mailError);
      console.error(`Registration OTP delivery failed (${failure.code}): ${failure.message}`);
      return res.status(503).json({ error: failure.message });
    }
    return res.status(200).json({ message: "A new verification code has been sent.", resendAt: now + REGISTRATION_RESEND_WAIT_MS });
  } catch (error) {
    console.error("Registration OTP resend failed:", error.message);
    return res.status(500).json({ error: "Unable to resend verification code" });
  }
}


async function getCurrentUser(req, res) {
  return res.status(200).json({
    user: req.user ? toSafeUser(req.user) : null
  });
}

async function updateCurrentUserProfile(req, res) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim().normalize("NFC") : "";
  const course = typeof req.body?.course === "string" ? req.body.course.trim() : "";
  if (!isValidName(name)) return res.status(400).json({ error: "Name must contain 2–30 letters. Single spaces between names are allowed; numbers and symbols are not." });
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (course.length > 150 || (user.authProvider !== "google" && !course)) {
      return res.status(400).json({ error: user.authProvider !== "google" && !course ? "Choose your course" : "Course must not exceed 150 characters" });
    }
    user.name = name;
    user.username = name;
    user.course = course;
    await user.save();
    return res.json({ user: toSafeUser(user) });
  } catch (error) {
    if (error.name === "ValidationError") return res.status(400).json({ error: "Profile information is invalid" });
    return res.status(500).json({ error: "Unable to update profile" });
  }
}

function hashRecoveryValue(value) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET || "").update(value).digest("hex");
}

async function findRecoveryUser(email) {
  return findUserByNormalizedEmail(
    email,
    "+resetOtpHash +resetOtpExpiresAt +resetOtpRequestedAt +resetOtpAttempts +resetTokenHash +resetTokenExpiresAt"
  );
}

async function requestPasswordReset(req, res) {
  const email = normalizeRequestEmail(req.body);
  if (!isAllowedUpangEmail(email)) return res.status(400).json({ error: UPANG_EMAIL_ACCESS_ERROR });

  try {
    const user = await findRecoveryUser(email);
    if (!user || user.status !== "active") return res.status(200).json({ message: RECOVERY_RESPONSE });
    const now = Date.now();
    if (user.resetOtpRequestedAt && now - user.resetOtpRequestedAt.getTime() < OTP_RESEND_WAIT_MS) {
      return res.status(200).json({ message: RECOVERY_RESPONSE });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashRecoveryValue(`${email}:${otp}`);
    const otpExpiresAt = new Date(now + OTP_TTL_MS);
    const issueResult = await User.updateOne({ _id: user._id }, {
      $set: { resetOtpHash: otpHash, resetOtpExpiresAt: otpExpiresAt, resetOtpRequestedAt: new Date(now), resetOtpAttempts: 0 },
      $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 }
    });
    if (!issueResult.matchedCount) return res.status(200).json({ message: RECOVERY_RESPONSE });

    try {
      await sendRecoveryOtp(email, otp);
    } catch (mailError) {
      await User.updateOne({ _id: user._id, resetOtpHash: otpHash }, {
        $unset: { resetOtpHash: 1, resetOtpExpiresAt: 1, resetOtpRequestedAt: 1 },
        $set: { resetOtpAttempts: 0 }
      });
      const mailFailure = describeRecoveryEmailError(mailError);
      console.error(`Password reset email delivery failed (${mailFailure.code}): ${mailFailure.message}`);
      return res.status(503).json({ error: mailFailure.message });
    }
    return res.status(200).json({ message: RECOVERY_RESPONSE });
  } catch (error) {
    console.error("Password reset request failed:", error.message);
    return res.status(500).json({ error: "Unable to process password reset request" });
  }
}

async function verifyPasswordResetOtp(req, res) {
  const email = normalizeRequestEmail(req.body);
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  if (!isAllowedUpangEmail(email)) return res.status(400).json({ error: UPANG_EMAIL_ACCESS_ERROR });
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "Enter a valid PHINMA email and six-digit code" });
  }

  try {
    const user = await findRecoveryUser(email);
    if (!user || user.status !== "active" || !user.resetOtpHash || !user.resetOtpExpiresAt || user.resetOtpExpiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: "The code is invalid or expired. Request a new code and try again." });
    }
    if ((user.resetOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      await User.updateOne({ _id: user._id, resetOtpHash: user.resetOtpHash }, {
        $unset: { resetOtpHash: 1, resetOtpExpiresAt: 1 }
      });
      return res.status(400).json({ error: "Too many incorrect attempts. Request a new code." });
    }

    const expected = Buffer.from(user.resetOtpHash, "hex");
    const received = Buffer.from(hashRecoveryValue(`${email}:${otp}`), "hex");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      const attemptResult = await User.updateOne({ _id: user._id, resetOtpHash: user.resetOtpHash }, { $inc: { resetOtpAttempts: 1 } });
      if (!attemptResult.matchedCount) return res.status(400).json({ error: "The code is invalid or expired. Request a new code and try again." });
      const attempts = (user.resetOtpAttempts || 0) + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await User.updateOne({ _id: user._id, resetOtpHash: user.resetOtpHash }, {
          $unset: { resetOtpHash: 1, resetOtpExpiresAt: 1 }
        });
      }
      return res.status(400).json({ error: attempts >= OTP_MAX_ATTEMPTS
        ? "Too many incorrect attempts. Request a new code."
        : "The code is invalid or expired. Check the code and try again." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const verifyResult = await User.updateOne({
      _id: user._id,
      resetOtpHash: user.resetOtpHash,
      resetOtpExpiresAt: { $gt: new Date() }
    }, {
      $set: { resetTokenHash: hashRecoveryValue(resetToken), resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS), resetOtpAttempts: 0 },
      $unset: { resetOtpHash: 1, resetOtpExpiresAt: 1 }
    });
    if (!verifyResult.matchedCount) return res.status(400).json({ error: "The code is invalid or expired. Request a new code and try again." });
    return res.status(200).json({ resetToken });
  } catch (error) {
    console.error("Password reset code verification failed:", error.message);
    return res.status(500).json({ error: "Unable to verify reset code" });
  }
}

async function resetPassword(req, res) {
  const email = normalizeRequestEmail(req.body);
  const resetToken = typeof req.body?.resetToken === "string" ? req.body.resetToken : "";
  const password = req.body?.password;
  const confirmPassword = req.body?.confirmPassword;
  if (!isAllowedUpangEmail(email)) return res.status(400).json({ error: UPANG_EMAIL_ACCESS_ERROR });
  if (resetToken.length !== 64) return res.status(400).json({ error: "Invalid or expired password reset session" });
  if (typeof password !== "string" || password.length < 8 || password.length > 12) {
    return res.status(400).json({ error: "Password must contain between 8 and 12 characters" });
  }
  if (!hasRequiredPasswordCharacter(password)) {
    return res.status(400).json({ error: "Password must contain at least one special character." });
  }
  if (/\s/.test(password)) return res.status(400).json({ error: "Password must not contain spaces." });
  if (password !== confirmPassword) return res.status(400).json({ error: "Passwords do not match" });

  try {
    const user = await findRecoveryUser(email);
    if (!user || user.status !== "active" || !user.resetTokenHash || !user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: "Invalid or expired password reset session" });
    }
    const expected = Buffer.from(user.resetTokenHash, "hex");
    const received = Buffer.from(hashRecoveryValue(resetToken), "hex");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return res.status(400).json({ error: "Invalid or expired password reset session" });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const resetCompletedAt = new Date();
    const resetResult = await User.updateOne({
      _id: user._id,
      resetTokenHash: user.resetTokenHash,
      resetTokenExpiresAt: { $gt: new Date() }
    }, {
      $set: { passwordHash, emailVerifiedAt: resetCompletedAt, lastLoginAt: resetCompletedAt, resetOtpAttempts: 0 },
      $unset: {
        resetOtpHash: 1,
        resetOtpExpiresAt: 1,
        resetOtpRequestedAt: 1,
        resetTokenHash: 1,
        resetTokenExpiresAt: 1
      }
    });
    if (!resetResult.modifiedCount) return res.status(400).json({ error: "Invalid or expired password reset session" });
    user.passwordHash = passwordHash;
    user.emailVerifiedAt = resetCompletedAt;
    user.lastLoginAt = resetCompletedAt;
    setAuthCookie(res, user);
    return res.status(200).json({
      message: "Password reset successfully.",
      user: toSafeUser(user)
    });
  } catch (error) {
    console.error("Password reset failed:", error.message);
    return res.status(500).json({ error: "Unable to reset password" });
  }
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
    path: "/"
  };
}

function toSafeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    course: user.course,
    role: user.role,
    status: user.status,
    avatar: user.avatar || null
  };
}

function setAuthCookie(res, user) {
  const token = createAccessToken(user);
  const cookieName = process.env.COOKIE_NAME || "upang_access_token";
  const payload = require("jsonwebtoken").decode(token);

  res.cookie(cookieName, token, getCookieOptions());
  res.setHeader("X-Auth-Expires-At", String(payload.exp * 1000));
}

async function findUserByNormalizedEmail(email, select = "") {
  let exactQuery = User.findOne({ email });
  if (select && exactQuery && typeof exactQuery.select === "function") exactQuery = exactQuery.select(select);
  const exactMatch = await exactQuery;
  if (exactMatch) return exactMatch;

  let fallbackQuery = User.findOne({
    $expr: {
      $eq: [
        { $toLower: { $trim: { input: { $convert: { input: "$email", to: "string", onError: "", onNull: "" } } } } },
        email
      ]
    }
  });
  if (select && fallbackQuery && typeof fallbackQuery.select === "function") fallbackQuery = fallbackQuery.select(select);
  return fallbackQuery;
}

function readRegistrationDetails(body) {
  const name = typeof body?.name === "string" ? body.name.normalize("NFC") : "";
  const email = normalizeRequestEmail(body);
  const course = typeof body?.course === "string" ? body.course.trim() : "";
  const password = body?.password;
  const confirmPassword = body?.confirmPassword;
  if (!isAllowedUpangEmail(email)) return { error: { status: 400, message: UPANG_EMAIL_ACCESS_ERROR } };
  if (!name || !email || !course || !password || !confirmPassword) {
    return { error: { status: 400, message: "Name, email, course, password, and confirmation are required" } };
  }
  if (!isValidName(name)) return { error: { status: 400, message: "Name must contain 2–30 letters. Use single spaces between names only; leading or trailing spaces, numbers, and symbols are not allowed." } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: { status: 400, message: "Enter a valid email address" } };
  if (name.length < 2 || name.length > 30) return { error: { status: 400, message: "Name must be between 2 and 30 characters" } };
  if (course.length > 150) return { error: { status: 400, message: "Course must not exceed 150 characters" } };
  if (typeof password !== "string" || password.length < 8 || password.length > 12) {
    return { error: { status: 400, message: "Password must contain between 8 and 12 characters" } };
  }
  if (!hasUniqueSpecialCharacters(password)) {
    return { error: { status: 400, message: "Password must contain at least one special character, and no special character may be repeated." } };
  }
  if (/\s/.test(password) || (typeof confirmPassword === "string" && /\s/.test(confirmPassword))) {
    return { error: { status: 400, message: "Password must not contain spaces." } };
  }
  if (password !== confirmPassword) return { error: { status: 400, message: "Passwords do not match" } };
  return { details: { name, email, course, password } };
}

async function requestRegistrationOtp(req, res) {
  const result = readRegistrationDetails(req.body);
  if (result.error) return res.status(result.error.status).json({ error: result.error.message });
  const { name, email, course, password } = result.details;

  try {
    if (await findUserByNormalizedEmail(email)) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const existingPending = await PendingRegistration.findOne({ email }).select("+otpRequestedAt");
    if (existingPending?.otpRequestedAt && Date.now() - existingPending.otpRequestedAt.getTime() < REGISTRATION_RESEND_WAIT_MS) {
      return res.status(429).json({
        code: "REGISTRATION_OTP_RECENTLY_SENT",
        error: "A verification code was sent recently. Enter it below.",
        verificationRequired: true
      });
    }

    const now = Date.now();
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashRecoveryValue(`${email}:${otp}`);
    const resumeToken = crypto.randomBytes(32).toString("hex");
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const pending = await PendingRegistration.findOneAndUpdate({ email }, {
      $set: {
        name,
        email,
        course,
        passwordHash,
        otpHash,
        otpExpiresAt: new Date(now + REGISTRATION_OTP_TTL_MS),
        otpRequestedAt: new Date(now),
        otpAttempts: 0,
        resumeTokenHash: hashRecoveryValue(resumeToken),
        expiresAt: new Date(now + REGISTRATION_SESSION_TTL_MS)
      },
    }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });

    try {
      await sendRegistrationOtp(email, otp);
    } catch (mailError) {
      await PendingRegistration.deleteOne({ _id: pending._id, otpHash });
      const mailFailure = describeRecoveryEmailError(mailError);
      console.error(`Registration OTP delivery failed (${mailFailure.code}): ${mailFailure.message}`);
      return res.status(503).json({ error: mailFailure.message });
    }
    res.cookie(REGISTRATION_COOKIE, resumeToken, registrationCookieOptions());
    return res.status(200).json({ message: "A verification code has been sent to your PHINMA email.", verificationRequired: true });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "An account with this email already exists" });
    console.error("Registration OTP request failed:", error.message);
    return res.status(500).json({ error: "Unable to start account verification" });
  }
}

async function verifyRegistrationOtp(req, res) {
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "Enter the six-digit verification code" });
  }

  try {
    const pending = await findPendingRegistration(req);
    if (!pending || !pending.otpHash || !pending.otpExpiresAt || pending.otpExpiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: "The code has expired. Request a new code and try again." });
    }
    if ((pending.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      await PendingRegistration.updateOne({ _id: pending._id, otpHash: pending.otpHash }, {
        $unset: { otpHash: 1, otpExpiresAt: 1 }
      });
      return res.status(400).json({ error: "Too many incorrect attempts. Request a new code." });
    }

    const expected = Buffer.from(pending.otpHash, "hex");
    const received = Buffer.from(hashRecoveryValue(`${pending.email}:${otp}`), "hex");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      const attempt = (pending.otpAttempts || 0) + 1;
      const update = attempt >= OTP_MAX_ATTEMPTS
        ? { $inc: { otpAttempts: 1 }, $unset: { otpHash: 1, otpExpiresAt: 1 } }
        : { $inc: { otpAttempts: 1 } };
      await PendingRegistration.updateOne({ _id: pending._id, otpHash: pending.otpHash }, update);
      return res.status(400).json({ error: attempt >= OTP_MAX_ATTEMPTS
        ? "Too many incorrect attempts. Request a new code."
        : "The code is invalid or expired. Check the code and try again." });
    }

    if (await findUserByNormalizedEmail(pending.email)) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      res.clearCookie(REGISTRATION_COOKIE, { ...registrationCookieOptions(), maxAge: undefined });
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const emailVerifiedAt = new Date();
    const created = await PendingRegistration.updateOne({
      _id: pending._id,
      otpHash: pending.otpHash,
      otpExpiresAt: { $gt: new Date() },
      resumeTokenHash: hashRecoveryValue(req.cookies[REGISTRATION_COOKIE])
    }, {
      $unset: { otpHash: 1, otpExpiresAt: 1 }
    });
    if (!created.matchedCount) return res.status(400).json({ error: "The code has expired. Request a new code and try again." });
    const user = await User.create({ name: pending.name, email: pending.email, course: pending.course, passwordHash: pending.passwordHash, role: "student", status: "active", emailVerifiedAt, lastLoginAt: null });
    await PendingRegistration.deleteOne({ _id: pending._id, resumeTokenHash: hashRecoveryValue(req.cookies[REGISTRATION_COOKIE]) });
    res.clearCookie(REGISTRATION_COOKIE, { ...registrationCookieOptions(), maxAge: undefined });
    return res.status(200).json({
      email: user.email,
      verified: true,
      accountCreated: true,
      message: "Account verified successfully! You can now log in."
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "An account with this email already exists" });
    console.error("Registration OTP verification failed:", error.message);
    return res.status(500).json({ error: "Unable to verify email address" });
  }
}

async function login(req, res) {
  try {
    const { ipHash, retryAfterSeconds } = await getLoginLockout(req);
    if (retryAfterSeconds > 0) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ error: `Too many failed sign-in attempts. Try again in ${retryAfterSeconds} seconds.`, retryAfterSeconds });
    }

    const email = normalizeRequestEmail(req.body);
    if (!isAllowedUpangEmail(email)) {
      return res.status(400).json({ error: UPANG_EMAIL_ACCESS_ERROR });
    }
    const password = req.body?.password;
    if (!email || typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (typeof password !== "string" || password.length > 12) {
      return res.status(400).json({ error: "Password must be 12 characters or fewer." });
    }
    if (/\s/.test(password)) {
      return res.status(400).json({ error: "Password must not contain spaces." });
    }

    const user = await User.findOne({ email }).select("+passwordHash _id name email emailVerifiedAt course role status");
    if (!user) return recordFailedLogin(ipHash, res);
    if (user.status !== "active") {
      return res.status(403).json({ error: "Your account is inactive. Please contact the administrator." });
    }
    if (typeof user.passwordHash !== "string" || !user.passwordHash.startsWith("$argon2")) {
      return recordFailedLogin(ipHash, res);
    }
    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      return recordFailedLogin(ipHash, res);
    }
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: "Verify your school email before signing in." });
    }

    user.lastLoginAt = new Date();
    await user.save();
    await LoginAttempt.deleteOne({ ipHash });
    setAuthCookie(res, user);
    return res.status(200).json({ user: toSafeUser(user) });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ error: "Unable to log in" });
  }
}

async function getLoginStatus(req, res) {
  try {
    const { failedAttempts, attemptsRemaining, retryAfterSeconds } = await getLoginLockout(req);
    return res.json({ failedAttempts, attemptsRemaining, retryAfterSeconds });
  } catch (error) {
    console.error("Unable to load login attempt status:", error.message);
    return res.status(500).json({ error: "Unable to load sign-in status" });
  }
}

async function recordFailedLogin(ipHash, res) {
  const attempt = await LoginAttempt.findOneAndUpdate(
    { ipHash },
    { $inc: { failures: 1 }, $set: { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, $setOnInsert: { blockedUntil: null } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (attempt.failures < LOGIN_LOCKOUT_MAX_ATTEMPTS) {
    return res.status(401).json({
      error: "Invalid email or password",
      failedAttempts: attempt.failures,
      attemptsRemaining: LOGIN_LOCKOUT_MAX_ATTEMPTS - attempt.failures
    });
  }

  const blockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_STEP_MS);
  // Concurrent bad-password requests may finish out of order. Keep the later
  // deadline so an earlier attempt cannot shorten the IP's active cooldown.
  await LoginAttempt.updateOne({ _id: attempt._id }, { $max: { blockedUntil } });
  const latestAttempt = await LoginAttempt.findById(attempt._id).select("blockedUntil").lean();
  const retryAfterSeconds = Math.max(1, Math.ceil((latestAttempt.blockedUntil.getTime() - Date.now()) / 1000));
  res.setHeader("Retry-After", String(retryAfterSeconds));
  return res.status(401).json({
    error: "Invalid email or password",
    failedAttempts: Math.min(attempt.failures, LOGIN_LOCKOUT_MAX_ATTEMPTS),
    attemptsRemaining: 0,
    retryAfterSeconds
  });
}

async function getLoginLockout(req) {
  const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
  const ipHash = hashRecoveryValue(`login-ip:${clientIp}`);
  const now = new Date();
  const attempt = await LoginAttempt.findOne({ ipHash }).select("failures blockedUntil").lean();
  if (attempt?.blockedUntil > now) {
    const failedAttempts = Math.min(attempt.failures, LOGIN_LOCKOUT_MAX_ATTEMPTS);
    return {
      ipHash,
      failedAttempts,
      attemptsRemaining: Math.max(0, LOGIN_LOCKOUT_MAX_ATTEMPTS - failedAttempts),
      retryAfterSeconds: Math.max(1, Math.ceil((attempt.blockedUntil.getTime() - now.getTime()) / 1000))
    };
  }
  if (attempt?.blockedUntil && attempt.blockedUntil <= now) {
    // Start a fresh three-attempt window after the full cooldown has elapsed.
    await LoginAttempt.updateOne(
      { ipHash, blockedUntil: attempt.blockedUntil },
      { $set: { failures: 0, blockedUntil: null } }
    );
    return { ipHash, failedAttempts: 0, attemptsRemaining: LOGIN_LOCKOUT_MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }
  const failedAttempts = Math.min(attempt?.failures || 0, LOGIN_LOCKOUT_MAX_ATTEMPTS);
  return {
    ipHash,
    failedAttempts,
    attemptsRemaining: Math.max(0, LOGIN_LOCKOUT_MAX_ATTEMPTS - failedAttempts),
    retryAfterSeconds: 0
  };
}
async function getCurrentUser(req, res) {
  return res.status(200).json({
    user: req.user ? toSafeUser(req.user) : null
  });
}

function logout(req, res) {
  const cookieName = process.env.COOKIE_NAME || "upang_access_token";

  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return res.status(204).send();
}

function normalizeGoogleSetting(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length >= 2 &&
      ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
       (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function getGoogleConfig() {
  return {
    clientId: normalizeGoogleSetting(process.env.GOOGLE_CLIENT_ID),
    clientSecret: normalizeGoogleSetting(process.env.GOOGLE_CLIENT_SECRET),
    redirectUri: normalizeGoogleSetting(process.env.GOOGLE_REDIRECT_URI)
  };
}

function getGoogleConfigurationIssue(config = getGoogleConfig()) {
  if (!config.clientId?.trim()) return "GOOGLE_CLIENT_ID is missing";
  if (/^(your[-_ ]|placeholder|replace[-_ ]|<)/i.test(config.clientId.trim())) return "GOOGLE_CLIENT_ID is a placeholder";
  if (!config.clientSecret?.trim()) return "GOOGLE_CLIENT_SECRET is missing";
  if (/^(your[-_ ]|placeholder|replace[-_ ]|<)/i.test(config.clientSecret.trim())) return "GOOGLE_CLIENT_SECRET is a placeholder";

  let redirect;
  try {
    redirect = new URL(config.redirectUri);
  } catch {
    return "GOOGLE_REDIRECT_URI is missing or invalid";
  }
  if (!/^https?:$/.test(redirect.protocol) || redirect.username || redirect.password ||
      redirect.search || redirect.hash || redirect.pathname !== "/api/auth/google/callback") {
    return "GOOGLE_REDIRECT_URI must point to /api/auth/google/callback";
  }
  if (process.env.NODE_ENV === "production" && redirect.protocol !== "https:") {
    return "GOOGLE_REDIRECT_URI must use HTTPS in production";
  }

  try {
    const frontend = new URL(process.env.FRONTEND_ORIGIN || "http://localhost:5173");
    if (!/^https?:$/.test(frontend.protocol) || frontend.username || frontend.password || frontend.search || frontend.hash || frontend.pathname !== "/") {
      return "FRONTEND_ORIGIN must be a valid origin without a path, query, or fragment";
    }
    if (process.env.NODE_ENV === "production" && frontend.protocol !== "https:") {
      return "FRONTEND_ORIGIN must use HTTPS in production";
    }
  } catch {
    return "FRONTEND_ORIGIN is invalid";
  }

  return null;
}

function reportGoogleConfigurationIssue(issue) {
  // Log only the setting name and validation result; never emit credential values.
  console.error("Google OAuth configuration problem:", issue);
}

function googleConfigurationErrorCode(issue) {
  if (/^GOOGLE_CLIENT_(ID|SECRET)/.test(issue)) return "google_credentials_invalid";
  if (/^GOOGLE_REDIRECT_URI/.test(issue)) return "google_redirect_mismatch";
  return "google_configuration_error";
}

function googleFailure(res, code, retryAfterSeconds = 0) {
  let frontendOrigin = "http://localhost:5173";
  try {
    const configuredOrigin = new URL(process.env.FRONTEND_ORIGIN || frontendOrigin);
    if (/^https?:$/.test(configuredOrigin.protocol) && !configuredOrigin.username && !configuredOrigin.password) {
      frontendOrigin = configuredOrigin.origin;
    }
  } catch {
    // Keep the failure redirect usable when FRONTEND_ORIGIN itself is malformed.
  }
  const destination = new URL("/", frontendOrigin);
  destination.searchParams.set("oauth_error", code);
  if (retryAfterSeconds > 0) destination.searchParams.set("retry_after", String(retryAfterSeconds));
  return res.redirect(destination.toString());
}

async function startGoogleLogin(req, res) {
  let lockout;
  try {
    lockout = await getLoginLockout(req);
  } catch (error) {
    console.error("Unable to check login lockout before Google OAuth:", error.message);
    return googleFailure(res, "google_database_unavailable");
  }
  if (lockout.retryAfterSeconds > 0) return googleFailure(res, "login_locked", lockout.retryAfterSeconds);

  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  const configIssue = getGoogleConfigurationIssue({ clientId, clientSecret, redirectUri });
  if (configIssue) {
    reportGoogleConfigurationIssue(configIssue);
    return googleFailure(res, googleConfigurationErrorCode(configIssue));
  }

  const state = crypto.randomBytes(32).toString("hex");
  res.cookie("upang_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/api/auth/google"
  });

  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("hd", "phinmaed.com");
  authorizationUrl.searchParams.set("prompt", "select_account");
  return res.redirect(authorizationUrl.toString());
}

async function googleCallback(req, res) {
  const stateCookie = req.cookies?.upang_google_oauth_state;
  res.clearCookie("upang_google_oauth_state", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google"
  });

  let lockout;
  try {
    lockout = await getLoginLockout(req);
  } catch (error) {
    console.error("Unable to check login lockout during Google OAuth:", error.message);
    return googleFailure(res, "google_database_unavailable");
  }
  if (lockout.retryAfterSeconds > 0) return googleFailure(res, "login_locked", lockout.retryAfterSeconds);

  if (!stateCookie || typeof req.query.state !== "string" ||
      stateCookie.length !== req.query.state.length ||
      !crypto.timingSafeEqual(Buffer.from(stateCookie), Buffer.from(req.query.state))) {
    return googleFailure(res, "google_state_invalid");
  }
  if (req.query.error) {
    return googleFailure(res, req.query.error === "org_internal" ? "google_org_restricted" : "google_cancelled");
  }
  if (typeof req.query.code !== "string") {
    return googleFailure(res, "google_cancelled");
  }

  let failureCode = "google_failed";
  try {
    const { clientId, clientSecret, redirectUri } = getGoogleConfig();
    const configIssue = getGoogleConfigurationIssue({ clientId, clientSecret, redirectUri });
    if (configIssue) {
      reportGoogleConfigurationIssue(configIssue);
      return googleFailure(res, googleConfigurationErrorCode(configIssue));
    }

    failureCode = "google_code_exchange_failed";
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.json().catch(() => ({}));
      if (tokenError.error === "invalid_client") {
        console.error("Google OAuth token exchange rejected the client; verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
        return googleFailure(res, "google_credentials_invalid");
      }
      if (tokenError.error === "invalid_grant") {
        console.error("Google OAuth authorization code was rejected; verify GOOGLE_REDIRECT_URI matches the Google Cloud authorized redirect URI exactly.");
        return googleFailure(res, "google_redirect_mismatch");
      }
      return googleFailure(res, failureCode);
    }

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) return googleFailure(res, failureCode);

    if (!tokens.id_token) return googleFailure(res, failureCode);
    failureCode = "google_identity_failed";
    const tokenInfoUrl = new URL("https://oauth2.googleapis.com/tokeninfo");
    tokenInfoUrl.searchParams.set("id_token", tokens.id_token);
    const identityResponse = await fetch(tokenInfoUrl);
    if (!identityResponse.ok) return googleFailure(res, failureCode);

    const identity = await identityResponse.json();
    const email = typeof identity.email === "string" ? normalizeEmail(String(identity.email)) : "";
    const googleId = typeof identity.sub === "string" ? String(identity.sub) : undefined;
    if (identity.aud !== clientId ||
        !["accounts.google.com", "https://accounts.google.com"].includes(identity.iss) ||
        ![true, "true"].includes(identity.email_verified) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return googleFailure(res, "google_unverified");
    }
    if (!isAllowedUpangEmail(email)) {
      return res.status(400).json({ error: UPANG_EMAIL_ACCESS_ERROR });
    }

    failureCode = "google_database_unavailable";
    let user = await findUserByNormalizedEmail(email);
    if (!user) {
      const name = typeof identity.name === "string" && identity.name.trim()
        ? identity.name.trim().normalize("NFC").slice(0, 30)
        : email.split("@")[0];
      if (!isValidName(name)) return googleFailure(res, "google_name_letters_only");
      try {
        user = await User.create({
          name,
          username: name,
          email,
          googleId,
          authProvider: "google",
          role: "student",
          avatar: typeof identity.picture === "string" ? identity.picture.slice(0, 2048) : undefined,
          emailVerifiedAt: new Date()
        });
      } catch (createError) {
        // Concurrent first sign-ins can race on the unique email/googleId indexes.
        if (createError.code !== 11000) throw createError;
        user = await findUserByNormalizedEmail(email);
        if (!user) throw createError;
      }
    }
    if (user.status !== "active") {
      return googleFailure(res, "google_account_unregistered");
    }

    failureCode = "google_session_failed";
    user.lastLoginAt = new Date();
    await user.save();
    setAuthCookie(res, user);
    const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
    return res.redirect(new URL("/", frontendOrigin).toString());
  } catch (error) {
    console.error("Google OAuth failed", {
      stage: failureCode,
      error: error.name,
      cause: error.cause?.code || undefined
    });
    return googleFailure(res, failureCode);
  }
}

module.exports = {
  requestRegistrationOtp,
  getPendingRegistration,
  cancelPendingRegistration,
  resendRegistrationOtp,
  verifyRegistrationOtp,
  login,
  getLoginStatus,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
  getCurrentUser,
  updateCurrentUserProfile,
  logout,
  startGoogleLogin,
  googleCallback
};
