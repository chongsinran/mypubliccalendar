const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const REFRESH_TOKEN_TTL_SECONDS = parseInt(process.env.REFRESH_TOKEN_TTL, 10) || 60 * 60 * 24 * 30; // 7 days default

const refreshTokenStore = new Map(); // refreshToken -> { username, expiresAt }

const pruneExpiredRefreshTokens = () => {
  const now = Date.now();
  for (const [token, session] of refreshTokenStore.entries()) {
    if (session.expiresAt <= now) {
      refreshTokenStore.delete(token);
    }
  }
};

const issueAccessToken = (username) =>
  jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const generateRefreshToken = (username) => {
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000;
  refreshTokenStore.set(refreshToken, { username, expiresAt });
  return refreshToken;
};

const login = (req, res) => {
  const { username, password } = req.body;
  pruneExpiredRefreshTokens();

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = issueAccessToken(username);
    const refreshToken = generateRefreshToken(username);
    res.json({ token, refreshToken });
  } else {
    res.status(401).json({ message: 'Invalid username or password' });
  }
};

const refresh = (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  pruneExpiredRefreshTokens();

  const session = refreshTokenStore.get(refreshToken);
  if (!session) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  refreshTokenStore.delete(refreshToken);

  const token = issueAccessToken(session.username);
  const nextRefreshToken = generateRefreshToken(session.username);

  res.json({ token, refreshToken: nextRefreshToken });
};

const logout = (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    refreshTokenStore.delete(refreshToken);
  }
  res.status(204).send();
};

module.exports = {
  login,
  refresh,
  logout,
};
