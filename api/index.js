// Vercel entry point: runs the unchanged Express app from server/server.js as a serverless function.
module.exports = require('../server/server.js').app;
