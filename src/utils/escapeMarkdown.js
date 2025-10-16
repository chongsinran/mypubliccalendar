function escapeMarkdownV2(text) {
  return text.replace(/[()\-]/g, '\\$&');
}

module.exports = escapeMarkdownV2;
