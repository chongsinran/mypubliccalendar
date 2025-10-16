const express = require('express');
const cors = require('cors');
const pool = require('./db');
const path = require('path');
const moment = require('moment-timezone');

moment.tz.setDefault('UTC');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '')));

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get all events
app.get('/events', async (req, res) => {
  try {
    let query = `
      SELECT id, title, description,
             to_char(start_date, 'YYYY-MM-DD') AS start,
             to_char(end_date,   'YYYY-MM-DD') AS "end",
             status
      FROM events
    `;
    let statuses = req.query['statuses[]'];

    if (statuses && !Array.isArray(statuses)) {
      statuses = [statuses];
    }

    const params = [];
    if (statuses && statuses.length > 0) {
      query += ` WHERE status = ANY($1::text[])`;
      params.push(statuses);
    }

    query += ` ORDER BY start_date, id`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// 3) In POST /events, pass through YYYY-MM-DD (no UTC conversion)
app.post('/events', async (req, res) => {
  try {
    const { title, description, start_date, end_date, status } = req.body;

    // Expecting start_date/end_date already as 'YYYY-MM-DD'
    const { rows } = await pool.query(
      `INSERT INTO events (title, description, start_date, end_date, status)
       VALUES ($1, $2, $3::date, $4::date, $5)
       RETURNING id, title, description,
                 to_char(start_date, 'YYYY-MM-DD') AS start,
                 to_char(end_date,   'YYYY-MM-DD') AS "end",
                 status`,
      [title, description, start_date, end_date, status || 'pending']
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Database Error:', err.message);
    res.status(500).json({ error: 'An error occurred while creating the event.' });
  }
});

// 4) In PUT /events/:id, whitelist fields + cast to date where needed (no UTC)
app.put('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = {};
    const allowed = ['title', 'description', 'start_date', 'end_date', 'status'];
    for (const key of allowed) {
      if (key in req.body) fields[key] = req.body[key];
    }

    const setParts = [];
    const values = [];
    let i = 1;

    for (const [k, v] of Object.entries(fields)) {
      if (k === 'start_date' || k === 'end_date') {
        setParts.push(`${k} = $${i}::date`);
      } else {
        setParts.push(`${k} = $${i}`);
      }
      values.push(v);
      i++;
    }
    values.push(id);

    const sql = `UPDATE events SET ${setParts.join(', ')} WHERE id = $${values.length}`;
    await pool.query(sql, values);
    res.json('Event was updated!');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete an event
app.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM events WHERE id = $1', [id]);
    res.json('Event was deleted!');
  } catch (err) {
    console.error(err.message);
  }
});

const https = require('https');

// Get latest chat ID from Telegram bot
app.get('/latest-chat-id', (req, res) => {
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
});

function escapeMarkdownV2(text) {
  return text.replace(/[()\-]/g, '\\$&');
}

// Check for due tasks and send a notification to Telegram
app.post('/check-due-tasks', async (req, res) => {
  try {
    const { rows: configRows } = await pool.query('SELECT * FROM telegram_config');
    if (configRows.length === 0) {
      return res.status(400).json({ error: 'Telegram configuration not found.' });
    }
    const { bot_token, chat_id } = configRows[0];

    const today = moment().format('YYYY-MM-DD');
    const { rows } = await pool.query('SELECT * FROM events WHERE end_date = $1 AND status != $2', [today, 'completed']);

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
});

app.post('/test-telegram', (req, res) => {
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
});

// Save Telegram configuration
app.post('/telegram-config', async (req, res) => {
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
});

// Get Telegram configuration
app.get('/telegram-config', async (req, res) => {
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
});

const port = process.env.PORT || 5001;

// Scheduler for daily notifications
setInterval(async () => {
  const now = moment().tz('Asia/Kuala_Lumpur');
  if (now.hours() == 9 && now.minutes() === 0) {
    console.log('Running daily due tasks check...');
    try {
      const { rows } = await pool.query('SELECT * FROM telegram_config');
      if (rows.length > 0) {
        const { bot_token, chat_id } = rows[0];
        const today = moment().format('YYYY-MM-DD');
        const { rows: eventRows } = await pool.query('SELECT * FROM events WHERE end_date = $1 AND status != $2', [today, 'completed']);

        if (eventRows.length > 0) {
          let message = `*Tasks Due Today (${today}):*\n\n`;
          eventRows.forEach(row => {
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
            });
          });

          apiReq.on('error', (e) => {
            console.error('Telegram API error:', e);
          });

          apiReq.write(postData);
          apiReq.end();
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  }
}, 60000); // Run every minute

app.listen(port, () => {
  console.log(`Server has started on port ${port}`);
});