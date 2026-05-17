console.log('=== SYSTEM ENVIRONMENT CHECK ===');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Defined (value masked)' : 'Undefined');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Defined (value masked)' : 'Undefined');
if (process.env.EMAIL_USER) {
  console.log('Detected EMAIL_USER:', process.env.EMAIL_USER);
}
