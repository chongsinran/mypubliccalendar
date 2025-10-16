const pool = require('../models/db');

const getEvents = async (req, res) => {
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
};

const createEvent = async (req, res) => {
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
};

const updateEvent = async (req, res) => {
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
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM events WHERE id = $1', [id]);
    res.json('Event was deleted!');
  } catch (err) {
    console.error(err.message);
  }
};

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
};