const https = require('https');
const moment = require('moment-timezone');
const pool = require('../models/db');

function escapeMarkdownV2(text) {
  return text.replace(/[()\-]/g, '\\$&');
}

const getLatestChatId = (req, res) => {
  const { botToken } = req.query;
  if (!botToken) {
    return res.status(400).json({ error: 'Bot token is required.' });
  }

  https.get(`https://api.telegram.org/bot${botToken}/getUpdates`, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => { data += chunk; });
    apiRes.on('end', () => {
      console.log('Telegram API response:', data);
      try {
        const updates = JSON.parse(data);
        if (updates.ok && updates.result.length > 0) {
          const lastUpdate = updates.result[updates.result.length - 1];
          const chatId = lastUpdate.message ? lastUpdate.message.chat.id : (lastUpdate.channel_post ? lastUpdate.channel_post.chat.id : null);
          if (chatId) {
            res.json({ chatId });
          } else {
            res.status(404).json({ error: 'No messages found.' });
          }
        } else {
          res.status(404).json({ error: 'No updates found.' });
        }
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse Telegram API response.' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: 'Failed to fetch updates from Telegram API.' });
  });
};

const checkDueTasks = async (req, res) => {
  try {
    const { rows: configRows } = await pool.query('SELECT * FROM telegram_config');
    if (configRows.length === 0) {
      return res.status(400).json({ error: 'Telegram configuration not found.' });
    }
    const { bot_token, chat_id } = configRows[0];

    const today = moment().format('YYYY-MM-DD');
    const { rows } = await pool.query(
      'SELECT * FROM events WHERE end_date = $1 AND status NOT IN ($2, $3)',
      [today, 'complete', 'rejected']
    );

    if (rows.length > 0) {
      let message = `*Tasks Due Today (${today}):*\n\n`;
      rows.forEach(row => {
        message += `*- ${row.title}* (${row.status})\n`;
      });

      const postData = JSON.stringify({
        chat_id: chat_id,
        text: escapeMarkdownV2(message),
        parse_mode: 'MarkdownV2'
      });

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${bot_token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => { data += chunk; });
        apiRes.on('end', () => {
          console.log('Telegram API response:', data);
          res.json({ message: 'Notification sent successfully!' });
        });
      });

      apiReq.on('error', (e) => {
        console.error('Telegram API error:', e);
        res.status(500).json({ message: 'Failed to send notification.' });
      });

      apiReq.write(postData);
      apiReq.end();
    } else {
      res.json({ message: 'No tasks due today.' });
    }
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).send('Server error');
  }
};

const testTelegram = (req, res) => {
  const { botToken, chatId } = req.body;
  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'Bot token and chat ID are required.' });
  }

  const message = 'Hello from your Project Calendar!';
  const postData = JSON.stringify({
    chat_id: chatId,
    text: message,
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${botToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => { data += chunk; });
    apiRes.on('end', () => {
      const response = JSON.parse(data);
      if (response.ok) {
        res.json({ message: 'Test message sent successfully!' });
      } else {
        res.status(500).json({ message: `Failed to send test message: ${response.description}` });
      }
    });
  });

  apiReq.on('error', (e) => {
    res.status(500).json({ message: 'Failed to send test message.' });
  });

  apiReq.write(postData);
  apiReq.end();
};

const saveTelegramConfig = async (req, res) => {
  const { botToken, chatId } = req.body;
  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'Bot token and chat ID are required.' });
  }

  try {
    // Check if a configuration already exists
    const { rows } = await pool.query('SELECT * FROM telegram_config');
    if (rows.length > 0) {
      // Update the existing configuration
      await pool.query('UPDATE telegram_config SET bot_token = $1, chat_id = $2 WHERE id = $3', [botToken, chatId, rows[0].id]);
    } else {
      // Insert a new configuration
      await pool.query('INSERT INTO telegram_config (bot_token, chat_id) VALUES ($1, $2)', [botToken, chatId]);
    }
    res.json({ message: 'Configuration saved successfully!' });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).send('Server error');
  }
};

const getTelegramConfig = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM telegram_config');
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json({});
    }
  } catch (err) {
    console.error('Error getting Telegram config:', err);
    res.status(500).json({ error: 'Failed to get Telegram configuration.', details: err.message });
  }
};

module.exports = {
    getLatestChatId,
    checkDueTasks,
    testTelegram,
    saveTelegramConfig,
    getTelegramConfig
};
