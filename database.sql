CREATE DATABASE project_calendar;

\c project_calendar;

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    color VARCHAR(7),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'bugged', 'announcement', 'scheduled-task'))
);

CREATE TABLE telegram_config (
    id SERIAL PRIMARY KEY,
    bot_token VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL
);

-- Placeholder for Telegram configuration
INSERT INTO telegram_config (bot_token, chat_id) VALUES ('YOUR_BOT_TOKEN', 'YOUR_CHAT_ID');
