const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJson, writeJson, withLock } = require('../utils/fileStore');

const router = express.Router();

const CONTACTS_FILE = path.join(__dirname, '../data/contacts.json');
const readContacts = () => readJson(CONTACTS_FILE);
const writeContacts = (data) => writeJson(CONTACTS_FILE, data);

// POST /api/contact — Save a contact message (persisted to file)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name and message are required.',
      });
    }

    const entry = {
      id: uuidv4(),
      name: String(name).trim().slice(0, 200),
      email: String(email || '').trim().slice(0, 255),
      phone: String(phone || '').trim().slice(0, 30),
      message: String(message).trim().slice(0, 2000),
      createdAt: new Date().toISOString(),
    };

    await withLock(CONTACTS_FILE, () => {
      const contacts = readContacts();
      contacts.push(entry);
      // Prevent unbounded growth: keep last 2000 contacts
      const MAX_CONTACTS = 2000;
      const toWrite = contacts.length > MAX_CONTACTS ? contacts.slice(-MAX_CONTACTS) : contacts;
      writeContacts(toWrite);
    });

    console.log(`[Contact] New message from "${entry.name}" (id: ${entry.id})`);

    res.status(201).json({
      success: true,
      message: 'Message received',
    });
  } catch (err) {
    console.error('[Contact] Error saving message:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save message' });
  }
});

module.exports = router;
