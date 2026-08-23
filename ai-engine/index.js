const config = require('./config');
const schema = require('./schema');
const prompts = require('./prompts');
const { analyzeCustomerReply } = require('./conversation_analyzer');

module.exports = {
  config,
  schema,
  prompts,
  analyzeCustomerReply
};
