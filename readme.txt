Project: Project Management Calendar

This project is a full-stack web application that provides a calendar for project management. It has a Node.js backend, a PostgreSQL database, and a frontend built with HTML, CSS, and JavaScript.

Features:
- Add, edit, and delete events.
- View event details.
- Update event status (pending, in-progress, completed).
- Different colors for different statuses.
- Drag and drop events to change their dates.
- Resize events to extend or shorten their duration.
- Umami-style CSS.
- All-day events (no time component).
- Start date cannot be after end date.
- Time is not displayed in the calendar view.
- Fixed: When updating the status of an event, the end date is no longer shifted one day earlier upon refresh.
- Daily Telegram notifications for due tasks.

Database Schema:

`events` table:
- id: SERIAL PRIMARY KEY
- title: VARCHAR(255) NOT NULL
- description: TEXT
- start_date: DATE NOT NULL
- end_date: DATE NOT NULL
- status: VARCHAR(20) DEFAULT 'pending'

`telegram_config` table:
- id: SERIAL PRIMARY KEY
- bot_token: VARCHAR(255) NOT NULL
- chat_id: VARCHAR(255) NOT NULL

Backend API Endpoints:
- GET /events: Get all events.
- POST /events: Create a new event.
- PUT /events/:id: Update an event.
- DELETE /events/:id: Delete an event.
- GET /telegram-config: Get the Telegram configuration.
- POST /telegram-config: Save the Telegram configuration.
- POST /check-due-tasks: Manually trigger a check for due tasks.
- GET /latest-chat-id: Get the latest chat ID from a Telegram bot.
- POST /test-telegram: Send a test message to a Telegram chat.

Telegram Notifications:

The application can send daily notifications for tasks that are due on the current day. To enable this feature, you need to configure a Telegram bot and provide its token and your chat ID.

Configuration:
1. Click on the "Telegram Config" button.
2. Enter your Telegram bot token and chat ID.
3. Click "Save".

Automatic Notifications:

The application will automatically check for due tasks every day at 9 am Malaysia time (GMT+8) and send a notification to the configured Telegram chat. This is a server-side process, so it will run as long as the server is running.

Manual Check:

You can also manually trigger a check for due tasks by clicking the "Check Due Tasks" button.