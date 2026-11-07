/**
 * Configure Twilio WhatsApp sandbox webhook
 * Run: node scripts/configure-sandbox.js
 */
import { config } from 'dotenv';
import twilio from 'twilio';

config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const WEBHOOK_URL = 'https://ai-receptionist-whatsapp-bot.vercel.app/webhook';

async function configureSandbox() {
  console.log('Configuring Twilio WhatsApp sandbox...');
  console.log('Webhook URL:', WEBHOOK_URL);

  try {
    // Fetch the sandbox number (Twilio sandbox is +14155238886)
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: '+14155238886' });

    if (numbers.length > 0) {
      const num = numbers[0];
      await client.incomingPhoneNumbers(num.sid).update({
        smsUrl: WEBHOOK_URL,
        smsMethod: 'POST',
      });
      console.log('✅ Webhook configured on:', num.phoneNumber, '(SID:', num.sid + ')');
    } else {
      // Sandbox number isn't in IncomingPhoneNumbers — configure via messaging service
      console.log('Sandbox number not in account numbers. Trying messaging services...');
      const services = await client.messaging.v1.services.list();
      console.log('Messaging services:', services.map(s => s.sid + ' ' + s.friendlyName));
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.log('\nManual setup instructions:');
    console.log('1. Go to https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn');
    console.log('2. Click "Sandbox Settings" tab');
    console.log('3. Set "When a message comes in" to:', WEBHOOK_URL);
    console.log('4. Method: HTTP POST');
    console.log('5. Save');
  }
}

configureSandbox();
