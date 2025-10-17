const pool = require('../models/db');

const VALID_STATUSES = ['pending', 'in-progress', 'complete', 'rejected'];
const VALID_TYPES = ['feature', 'bug', 'scheduled', 'announcement'];

const normaliseStatus = (value) => {
  const candidate = (value || '').toLowerCase();
  return VALID_STATUSES.includes(candidate) ? candidate : 'pending';
};

const normaliseType = (value) => {
  const candidate = (value || '').toLowerCase();
  return VALID_TYPES.includes(candidate) ? candidate : 'feature';
};

const getEvents = async (req, res) => {
  try {
    let query = `
      SELECT id, title, description,
             to_char(start_date, 'YYYY-MM-DD') AS start,
             to_char(end_date,   'YYYY-MM-DD') AS "end",
             task_type,
             status
      FROM events
    `;
    let statuses = req.query['statuses[]'];
    let types = req.query['types[]'];

    if (statuses && !Array.isArray(statuses)) {
      statuses = [statuses];
    }

    if (types && !Array.isArray(types)) {
      types = [types];
    }

    const params = [];
    const where = [];
    if (statuses && statuses.length > 0) {
      params.push(statuses);
      where.push(`status = ANY($${params.length}::text[])`);
    }

    if (types && types.length > 0) {
      params.push(types);
      where.push(`task_type = ANY($${params.length}::text[])`);
    }

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ` ORDER BY start_date, id`;

    const { rows } = await pool.query(query, params);
    const normalisedRows = rows.map(row => ({
      ...row,
      task_type: normaliseType(row.task_type),
      status: normaliseStatus(row.status),
    }));
    res.json(normalisedRows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      start_date,
      end_date,
      status,
      task_type,
    } = req.body;

    const normalizedStatus = normaliseStatus(status);
    const normalizedType = normaliseType(task_type);

    // Expecting start_date/end_date already as 'YYYY-MM-DD'
    const { rows } = await pool.query(
      `INSERT INTO events (title, description, start_date, end_date, task_type, status)
       VALUES ($1, $2, $3::date, $4::date, $5, $6)
       RETURNING id, title, description,
                 to_char(start_date, 'YYYY-MM-DD') AS start,
                 to_char(end_date,   'YYYY-MM-DD') AS "end",
                 task_type,
                 status`,
      [
        title,
        description,
        start_date,
        end_date,
        normalizedType,
        normalizedStatus,
      ]
    );
    const created = rows[0];
    res.json({
      ...created,
      task_type: normalizedType,
      status: normalizedStatus,
    });
  } catch (err) {
    console.error('Database Error:', err.message);
    res.status(500).json({ error: 'An error occurred while creating the event.' });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = {};
    const allowed = ['title', 'description', 'start_date', 'end_date', 'status', 'task_type'];
    for (const key of allowed) {
      if (key in req.body) {
        if (key === 'status') {
          fields[key] = normaliseStatus(req.body[key]);
        } else if (key === 'task_type') {
          fields[key] = normaliseType(req.body[key]);
        } else {
          fields[key] = req.body[key];
        }
      }
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

    if (setParts.length === 0) {
      return res.status(400).json({ error: 'No valid fields supplied for update.' });
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
