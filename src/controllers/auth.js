const jwt = require('jsonwebtoken');

const login = (req, res) => {
  const { username, password } = req.body;

  // For simplicity, using hardcoded username and password
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, 'your_secret_key', { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid username or password' });
  }
};

module.exports = {
  login,
};