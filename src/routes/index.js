const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/events');
const telegramController = require('../controllers/telegram');

const authController = require('../controllers/auth');

// Auth route
router.post('/login', authController.login);

const authenticateJWT = require('../middleware/auth');

// Auth route
router.post('/login', authController.login);

// Event routes
router.get('/events', authenticateJWT, eventsController.getEvents);
router.post('/events', authenticateJWT, eventsController.createEvent);
router.put('/events/:id', authenticateJWT, eventsController.updateEvent);
router.delete('/events/:id', authenticateJWT, eventsController.deleteEvent);

// Telegram routes
router.get('/latest-chat-id', authenticateJWT, telegramController.getLatestChatId);
router.post('/check-due-tasks', authenticateJWT, telegramController.checkDueTasks);
router.post('/test-telegram', authenticateJWT, telegramController.testTelegram);
router.post('/telegram-config', authenticateJWT, telegramController.saveTelegramConfig);
router.get('/telegram-config', authenticateJWT, telegramController.getTelegramConfig);

module.exports = router;