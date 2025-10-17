# 📅 Project Management Calendar

![Logo](https://via.placeholder.com/150)

A full-stack web application that provides a calendar for project management.

## 🚀 Live Demo

[Link to live demo](https://your-live-demo-link.com)

## 📸 Screenshots

| Calendar View | Add/Edit Event Modal |
| :---: | :---: |
| ![Calendar View](https://via.placeholder.com/400x300) | ![Add/Edit Event Modal](https://via.placeholder.com/400x300) |

## ✨ Features

*   **🗓️ Calendar View:** View all your events in a monthly calendar view.
*   **➕ Add, Edit, and Delete Events:** Easily add, edit, and delete events.
*   **📝 Event Details:** View the details of an event, including the title, description, start date, end date, and status.
*   **🎨 Task Type Colors:** Feature, Bug, Scheduled, and Announcement items surface with distinct colour accents while statuses track progress (pending, in-progress, complete, rejected).
*   **🔄 Drag and Drop:** Drag and drop events to change their dates.
*   **↔️ Resize Events:** Resize events to extend or shorten their duration.
*   **☀️ All-Day Events:** Create all-day events with no time component.
*   **📅 Date Validation:** The start date cannot be after the end date.
*   **⏰ No Time:** The time is not displayed in the calendar view.
*   **🔔 Telegram Notifications:** Get daily Telegram notifications for due tasks.
*   **🔒 JWT Authentication:** Secure your application with JSON Web Token authentication.
*   **🔑 Login Modal:** A simple and elegant login modal for user authentication.

## 🛠️ Tech Stack

*   **Frontend:**
    *   HTML
    *   CSS
    *   JavaScript
    *   [FullCalendar](https://fullcalendar.io/)
    *   [moment.js](https://momentjs.com/)
*   **Backend:**
    *   [Node.js](https://nodejs.org/)
    *   [Express.js](https://expressjs.com/)
    *   [PostgreSQL](https://www.postgresql.org/)
    *   [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
    *   [dotenv](https://github.com/motdotla/dotenv)
*   **DevOps:**
    *   [Docker](https://www.docker.com/)
    *   [Docker Compose](https://docs.docker.com/compose/)

## ⚙️ Installation

To run this project locally, you will need to have Docker and Docker Compose installed.

1.  Clone the repository:

    ```bash
    git clone https://github.com/your-username/your-repository.git
    ```

2.  Create a `.env` file in the root directory of the project and add the following:

    ```
    DB_USER=postgres
    DB_PASSWORD=123123123
    DB_HOST=db
    DB_PORT=5432
    DB_DATABASE=project_calendar
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=password
    ```

3.  Run the following command to start the application:

    ```bash
    docker-compose up -d
    ```

4.  The application will be available at http://localhost:5001.

## 🔑 Configuration

### `.env` File

The `.env` file contains the following environment variables:

| Variable | Description |
| :--- | :--- |
| `DB_USER` | The username for the PostgreSQL database. |
| `DB_PASSWORD` | The password for the PostgreSQL database. |
| `DB_HOST` | The host of the PostgreSQL database. |
| `DB_PORT` | The port of the PostgreSQL database. |
| `DB_DATABASE` | The name of the PostgreSQL database. |
| `ADMIN_USERNAME` | The username for the admin user. |
| `ADMIN_PASSWORD` | The password for the admin user. |

### Telegram Notifications

To enable Telegram notifications, you need to configure a Telegram bot and provide its token and your chat ID.

1.  Click on the "Telegram Config" button.
2.  Enter your Telegram bot token and chat ID.
3.  Click "Save".

## Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/login` | Login to the application. |
| `GET` | `/events` | Get all events. |
| `POST` | `/events` | Create a new event. |
| `PUT` | `/events/:id` | Update an event. |
| `DELETE` | `/events/:id` | Delete an event. |
| `GET` | `/telegram-config` | Get the Telegram configuration. |
| `POST` | `/telegram-config` | Save the Telegram configuration. |
| `POST` | `/check-due-tasks` | Manually trigger a check for due tasks. |
| `GET` | `/latest-chat-id` | Get the latest chat ID from a Telegram bot. |
| `POST` | `/test-telegram` | Send a test message to a Telegram chat. |

## 🗄️ Database Schema

### `events` table

| Column | Type | Modifiers |
| :--- | :--- | :--- |
| `id` | `integer` | `not null default nextval('events_id_seq'::regclass)` |
| `title` | `character varying(255)` | `not null` |
| `description` | `text` | |
| `start_date` | `date` | `not null` |
| `end_date` | `date` | `not null` |
| `status` | `character varying(20)` | `default 'pending'::character varying` |

### `telegram_config` table

| Column | Type | Modifiers |
| :--- | :--- | :--- |
| `id` | `integer` | `not null default nextval('telegram_config_id_seq'::regclass)` |
| `bot_token` | `character varying(255)` | `not null` |
| `chat_id` | `character varying(255)` | `not null` |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
